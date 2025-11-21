// Unified storage interface that works with both in-memory store and Durable Objects
import { Session, Vote } from './types';
import { store } from './store';
import * as doHelpers from './durable-object-helpers';
import { DurableObjectBindings } from './durable-object-helpers';

export interface StorageAdapter {
  createSession(session: Session): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  updateSession(sessionId: string, session: Session): Promise<void>;
  closeSession(sessionId: string): Promise<Date>;
  deleteSession(sessionId: string): Promise<void>;
  addVote(vote: Vote): Promise<void>;
  hasVoted(sessionId: string, voterToken: string): Promise<boolean>;
  getVotes(sessionId: string): Promise<Vote[]>;
}

class InMemoryStorageAdapter implements StorageAdapter {
  async createSession(session: Session): Promise<void> {
    store.createSession(session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return store.getSession(sessionId) || null;
  }

  async updateSession(sessionId: string, session: Session): Promise<void> {
    store.updateSession(sessionId, session);
  }

  async closeSession(sessionId: string): Promise<Date> {
    const session = store.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    const closedAt = new Date();
    const updatedSession = {
      ...session,
      status: 'closed' as const,
      closedAt,
    };
    store.updateSession(sessionId, updatedSession);
    return closedAt;
  }

  async deleteSession(sessionId: string): Promise<void> {
    store.deleteSession(sessionId);
  }

  async addVote(vote: Vote): Promise<void> {
    store.addVote(vote);
  }

  async hasVoted(sessionId: string, voterToken: string): Promise<boolean> {
    return store.hasVoted(sessionId, voterToken);
  }

  async getVotes(sessionId: string): Promise<Vote[]> {
    return store.getVotes(sessionId);
  }
}

class DurableObjectStorageAdapter implements StorageAdapter {
  constructor(private env: DurableObjectBindings) {}

  async createSession(session: Session): Promise<void> {
    await doHelpers.createSession(session.sessionId, session, this.env);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return await doHelpers.getSession(sessionId, this.env);
  }

  async updateSession(sessionId: string, session: Session): Promise<void> {
    // For Durable Objects, updates happen through specific operations
    // This is handled by the DO itself when votes are submitted or session is closed
    await doHelpers.updateSession(sessionId, session, this.env);
  }

  async closeSession(sessionId: string): Promise<Date> {
    return await doHelpers.closeSession(sessionId, this.env);
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Durable Objects persist data; deletion is not typically needed
    // Sessions are managed by their lifecycle (creation, voting, closing)
    throw new Error('Session deletion not supported with Durable Objects');
  }

  async addVote(vote: Vote): Promise<void> {
    await doHelpers.submitVote(vote.sessionId, vote, this.env);
  }

  async hasVoted(sessionId: string, voterToken: string): Promise<boolean> {
    return await doHelpers.hasVoted(sessionId, voterToken, this.env);
  }

  async getVotes(sessionId: string): Promise<Vote[]> {
    return await doHelpers.getVotes(sessionId, this.env);
  }
}

export function createStorageAdapter(env?: DurableObjectBindings): StorageAdapter {
  if (env && env.VOTING_SESSION) {
    return new DurableObjectStorageAdapter(env);
  }
  return new InMemoryStorageAdapter();
}
