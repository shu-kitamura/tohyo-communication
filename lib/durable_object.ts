import {
  Session,
  Choice,
  CreateSessionRequest,
  SubmitVoteRequest,
} from './types';

interface BroadcastMessage {
  event: string;
  data: unknown;
}

export class VoteSessionDO implements DurableObject {
  state: DurableObjectState;
  private sessions: Set<ReadableStreamDefaultController> =
    new Set();

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    void env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Initialize session
    if (method === 'POST' && path === '/init') {
      return this.handleInit(request);
    }

    // Get session info
    if (method === 'GET' && path === '/') {
      return this.handleGetSession(request);
    }

    // Submit vote
    if (method === 'POST' && path === '/vote') {
      return this.handleVote(request);
    }

    // Close session
    if (method === 'POST' && path === '/close') {
      return this.handleClose();
    }

    // SSE Stream
    if (method === 'GET' && path === '/stream') {
      return this.handleStream();
    }

    // Export data
    if (method === 'GET' && path === '/export') {
      return this.handleExport();
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleInit(request: Request): Promise<Response> {
    const body =
      (await request.json()) as CreateSessionRequest & {
        sessionId: string;
      };

    const choices: Choice[] = body.choices.map((c, i) => ({
      choiceId: (i + 1).toString(),
      text: c.text,
      voteCount: 0,
    }));

    const session: Session = {
      sessionId: body.sessionId,
      question: body.question,
      voteType: body.voteType,
      choices: choices,
      status: 'active',
      createdAt: new Date(),
    };

    await this.state.storage.put('session', session);
    // Set alarm to delete after 24 hours
    await this.state.storage.setAlarm(
      Date.now() + 24 * 60 * 60 * 1000
    );

    return new Response(JSON.stringify(session), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async handleGetSession(
    request: Request
  ): Promise<Response> {
    const session =
      await this.state.storage.get<Session>('session');
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404 }
      );
    }

    // Check if user has voted
    const url = new URL(request.url);
    const voterToken = url.searchParams.get('voterToken');
    let hasVoted = false;
    if (voterToken) {
      hasVoted =
        (await this.state.storage.get<boolean>(
          `voter:${voterToken}`
        )) || false;
    }

    const response = {
      ...session,
      canVote: session.status === 'active' && !hasVoted,
      message:
        session.status === 'closed'
          ? '投票は終了しました'
          : hasVoted
            ? '既に投票済みです'
            : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async handleVote(request: Request): Promise<Response> {
    const session =
      await this.state.storage.get<Session>('session');
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404 }
      );
    }

    if (session.status === 'closed') {
      return new Response(
        JSON.stringify({ error: '投票は終了しました' }),
        { status: 403 }
      );
    }

    const body =
      (await request.json()) as SubmitVoteRequest & {
        voterToken: string;
      };
    const { choiceIds, voterToken } = body;

    if (!voterToken) {
      return new Response(
        JSON.stringify({ error: 'Voter token required' }),
        { status: 400 }
      );
    }

    const hasVoted = await this.state.storage.get<boolean>(
      `voter:${voterToken}`
    );
    if (hasVoted) {
      return new Response(
        JSON.stringify({ error: '既に投票済みです' }),
        { status: 409 }
      );
    }

    // Update vote counts
    let updated = false;
    session.choices = session.choices.map((c) => {
      if (choiceIds.includes(c.choiceId)) {
        updated = true;
        return { ...c, voteCount: c.voteCount + 1 };
      }
      return c;
    });

    if (!updated) {
      return new Response(
        JSON.stringify({ error: 'Invalid choices' }),
        { status: 400 }
      );
    }

    // Save session and voter record
    await this.state.storage.put('session', session);
    await this.state.storage.put(
      `voter:${voterToken}`,
      true
    );

    // Broadcast update
    this.broadcast({ event: 'update', data: session });

    return new Response(
      JSON.stringify({ message: '投票が完了しました' }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  async handleClose(): Promise<Response> {
    const session =
      await this.state.storage.get<Session>('session');
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404 }
      );
    }

    session.status = 'closed';
    session.closedAt = new Date();
    await this.state.storage.put('session', session);

    this.broadcast({
      event: 'closed',
      data: { message: '投票が終了しました' },
    });

    return new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async handleExport(): Promise<Response> {
    const session =
      await this.state.storage.get<Session>('session');
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  handleStream(): Response {
    let controller: ReadableStreamDefaultController;

    const stream = new ReadableStream({
      start: (c) => {
        controller = c;
        this.sessions.add(controller);
      },
      cancel: () => {
        this.sessions.delete(controller);
      },
    });

    // Send initial data
    this.state.storage
      .get<Session>('session')
      .then((session: Session | undefined) => {
        if (session) {
          const payload = { event: 'init', data: session };
          const data = `data: ${JSON.stringify(payload)}\n\n`;
          try {
            controller.enqueue(
              new TextEncoder().encode(data)
            );
          } catch {
            // Ignore if stream is closed
          }
        }
      });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  broadcast(message: BroadcastMessage) {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    const encoded = new TextEncoder().encode(data);

    for (const controller of this.sessions) {
      try {
        controller.enqueue(encoded);
      } catch {
        this.sessions.delete(controller);
      }
    }
  }

  async alarm() {
    // Delete all data
    await this.state.storage.deleteAll();
  }
}
