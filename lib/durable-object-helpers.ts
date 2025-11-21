// Helper functions to interact with Durable Objects
import { Session, Vote } from './types';

// Cloudflare Durable Objects type definitions
// These types are available in the Cloudflare Workers runtime but not during build
export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

export interface DurableObjectStub {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  put<T = unknown>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T = unknown>(): Promise<Map<string, T>>;
}

export interface DurableObjectState {
  storage: DurableObjectStorage;
  id: DurableObjectId;
  waitUntil(promise: Promise<unknown>): void;
}

export interface DurableObjectBindings {
  VOTING_SESSION: DurableObjectNamespace;
}

/**
 * Get a Durable Object stub for a voting session
 */
export function getVotingSessionStub(
  sessionId: string,
  env: DurableObjectBindings
): DurableObjectStub {
  const id = env.VOTING_SESSION.idFromName(sessionId);
  return env.VOTING_SESSION.get(id);
}

/**
 * Create a new voting session in Durable Object
 */
export async function createSession(
  sessionId: string,
  session: Session,
  env: DurableObjectBindings
): Promise<void> {
  const stub = getVotingSessionStub(sessionId, env);
  const response = await stub.fetch('http://do/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });

  if (!response.ok) {
    throw new Error('Failed to create session in Durable Object');
  }
}

/**
 * Get session data from Durable Object
 */
export async function getSession(
  sessionId: string,
  env: DurableObjectBindings
): Promise<Session | null> {
  const stub = getVotingSessionStub(sessionId, env);
  const response = await stub.fetch('http://do/session', {
    method: 'GET',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to get session from Durable Object');
  }

  return await response.json();
}

/**
 * Submit a vote to Durable Object
 */
export async function submitVote(
  sessionId: string,
  vote: Vote,
  env: DurableObjectBindings
): Promise<void> {
  const stub = getVotingSessionStub(sessionId, env);
  const response = await stub.fetch('http://do/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vote),
  });

  if (!response.ok) {
    throw new Error('Failed to submit vote to Durable Object');
  }
}

/**
 * Close a voting session in Durable Object
 */
export async function closeSession(
  sessionId: string,
  env: DurableObjectBindings
): Promise<Date> {
  const stub = getVotingSessionStub(sessionId, env);
  const response = await stub.fetch('http://do/close', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to close session in Durable Object');
  }

  const data = await response.json();
  return new Date(data.closedAt);
}

/**
 * Check if a voter has already voted
 */
export async function hasVoted(
  sessionId: string,
  voterToken: string,
  env: DurableObjectBindings
): Promise<boolean> {
  const stub = getVotingSessionStub(sessionId, env);
  const response = await stub.fetch('http://do/check-voted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to check voted status from Durable Object');
  }

  const data = await response.json();
  return data.hasVoted;
}

/**
 * Get all votes for a session
 */
export async function getVotes(
  sessionId: string,
  env: DurableObjectBindings
): Promise<Vote[]> {
  const stub = getVotingSessionStub(sessionId, env);
  const response = await stub.fetch('http://do/votes', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get votes from Durable Object');
  }

  return await response.json();
}
