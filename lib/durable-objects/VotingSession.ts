// Durable Object for managing voting session state
import { Session, Vote } from '../types';
import type { DurableObjectState } from '../durable-object-helpers';

export class VotingSession {
  private state: DurableObjectState;
  private session: Session | null = null;
  private votes: Vote[] = [];
  private voterTokens: Set<string> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Initialize state from storage if not loaded
      if (!this.session) {
        await this.loadFromStorage();
      }

      // Route handlers
      if (method === 'POST' && path === '/create') {
        return await this.handleCreateSession(request);
      }

      if (method === 'GET' && path === '/session') {
        return await this.handleGetSession();
      }

      if (method === 'POST' && path === '/vote') {
        return await this.handleSubmitVote(request);
      }

      if (method === 'POST' && path === '/close') {
        return await this.handleCloseSession();
      }

      if (method === 'GET' && path === '/votes') {
        return await this.handleGetVotes();
      }

      if (method === 'POST' && path === '/check-voted') {
        return await this.handleCheckVoted(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error in VotingSession:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async loadFromStorage(): Promise<void> {
    const [session, votes, voterTokens] = await Promise.all([
      this.state.storage.get<Session>('session'),
      this.state.storage.get<Vote[]>('votes'),
      this.state.storage.get<string[]>('voterTokens'),
    ]);

    this.session = session || null;
    this.votes = votes || [];
    this.voterTokens = new Set(voterTokens || []);
  }

  private async handleCreateSession(request: Request): Promise<Response> {
    const session: Session = await request.json();
    this.session = session;
    this.votes = [];
    this.voterTokens = new Set();

    await this.state.storage.put('session', session);
    await this.state.storage.put('votes', this.votes);
    await this.state.storage.put('voterTokens', []);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleGetSession(): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleSubmitVote(request: Request): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const vote: Vote = await request.json();

    // Add vote
    this.votes.push(vote);
    this.voterTokens.add(vote.voterToken);

    // Update vote counts in session
    const updatedChoices = this.session.choices.map((choice) => {
      if (vote.choiceIds.includes(choice.choiceId)) {
        return { ...choice, voteCount: choice.voteCount + 1 };
      }
      return choice;
    });

    this.session = { ...this.session, choices: updatedChoices };

    // Persist to storage
    await Promise.all([
      this.state.storage.put('session', this.session),
      this.state.storage.put('votes', this.votes),
      this.state.storage.put('voterTokens', Array.from(this.voterTokens)),
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleCloseSession(): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const closedAt = new Date();
    this.session = {
      ...this.session,
      status: 'closed',
      closedAt,
    };

    await this.state.storage.put('session', this.session);

    return new Response(
      JSON.stringify({ success: true, closedAt: closedAt.toISOString() }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async handleGetVotes(): Promise<Response> {
    return new Response(JSON.stringify(this.votes), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleCheckVoted(request: Request): Promise<Response> {
    const { voterToken } = await request.json();
    const hasVoted = this.voterTokens.has(voterToken);

    return new Response(JSON.stringify({ hasVoted }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
