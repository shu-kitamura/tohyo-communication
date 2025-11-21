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

  async addVote(vote: Vote): Promise<void> {
    store.addVote(vote);
    
    // Update vote counts in session
    const session = store.getSession(vote.sessionId);
    if (session) {
      const updatedChoices = session.choices.map((choice) => {
        if (vote.choiceIds.includes(choice.choiceId)) {
          return { ...choice, voteCount: choice.voteCount + 1 };
        }
        return choice;
      });
      
      const updatedSession = { ...session, choices: updatedChoices };
      store.updateSession(vote.sessionId, updatedSession);
    }
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
    // For Durable Objects, use the specialized closeSession method
    if (session.status === 'closed') {
      await doHelpers.closeSession(sessionId, this.env);
    }
    // Note: Other session updates (like vote counts) happen automatically 
    // through the submitVote operation in the Durable Object
  }

  async closeSession(sessionId: string): Promise<Date> {
    return await doHelpers.closeSession(sessionId, this.env);
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
