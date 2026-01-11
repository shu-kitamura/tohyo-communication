// In-memory data store for voting sessions and votes
import { Session, Vote } from "./types";

class VotingStore {
  private sessions = new Map<string, Session>();
  private votes = new Map<string, Vote[]>(); // sessionId -> votes[]
  private voterTokens = new Map<string, Set<string>>(); // sessionId -> Set of voterTokens

  // Session management
  createSession(session: Session): void {
    this.sessions.set(session.sessionId, session);
    this.votes.set(session.sessionId, []);
    this.voterTokens.set(session.sessionId, new Set());
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.votes.delete(sessionId);
    this.voterTokens.delete(sessionId);
  }

  // Vote management
  addVote(vote: Vote): void {
    const sessionVotes = this.votes.get(vote.sessionId) || [];
    sessionVotes.push(vote);
    this.votes.set(vote.sessionId, sessionVotes);

    const tokens = this.voterTokens.get(vote.sessionId) || new Set();
    tokens.add(vote.voterToken);
    this.voterTokens.set(vote.sessionId, tokens);
  }

  hasVoted(sessionId: string, voterToken: string): boolean {
    const tokens = this.voterTokens.get(sessionId);
    return tokens ? tokens.has(voterToken) : false;
  }

  getVotes(sessionId: string): Vote[] {
    return this.votes.get(sessionId) || [];
  }

  // Cleanup old sessions (24 hours timeout)
  cleanupOldSessions(): void {
    const now = new Date();
    const timeoutMs = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      if (age > timeoutMs) {
        this.deleteSession(sessionId);
      }
    }
  }
}

// Singleton instance
export const store = new VotingStore();

// Cleanup old sessions every hour
setInterval(
  () => {
    store.cleanupOldSessions();
  },
  60 * 60 * 1000
);
