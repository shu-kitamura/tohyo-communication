// Helper functions to interact with Durable Objects
import { Session, Vote } from './types';

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

/**
 * Update a session (used for closing)
 */
export async function updateSession(
  sessionId: string,
  session: Session,
  env: DurableObjectBindings
): Promise<void> {
  await closeSession(sessionId, env);
}
