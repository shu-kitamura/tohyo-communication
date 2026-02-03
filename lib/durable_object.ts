import { Session, Choice, CreateSessionRequest, SubmitVoteRequest } from "./types";

/**
 * Server-Sent Events (SSE) でブロードキャストするメッセージ型
 */
interface BroadcastMessage {
  /** イベント種別（update, closedなど） */
  event: string;
  /** イベントに付随するデータ */
  data: unknown;
}

/**
 * Durable Objectとして動作する投票セッション管理クラス
 *
 * 各セッションごとに独立したインスタンスが立ち上がり、
 * 投票データの整合性と永続化を担保します。
 * SSEを使用してリアルタイムに投票結果を配信します。
 */
export class VoteSessionDO implements DurableObject {
  state: DurableObjectState;
  /** SSEストリームのコントローラーを管理するセット */
  private sessions: Set<ReadableStreamDefaultController> = new Set();

  /**
   * Durable Objectのコンストラクタ
   *
   * @param state - Durable Objectのステート（ストレージとアラーム管理）
   * @param env - 環境変数（現在未使用）
   */
  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    void env;
  }

  /**
   * Durable Objectへのリクエストを処理するメインハンドラ
   *
   * パスとHTTPメソッドに応じて適切なハンドラメソッドを呼び出します。
   *
   * @param request - クライアントからのHTTPリクエスト
   * @returns HTTPレスポンス
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Initialize session
    if (method === "POST" && path === "/init") {
      return this.handleInit(request);
    }

    // Get session info
    if (method === "GET" && path === "/") {
      return this.handleGetSession(request);
    }

    // Submit vote
    if (method === "POST" && path === "/vote") {
      return this.handleVote(request);
    }

    // Close session
    if (method === "POST" && path === "/close") {
      return this.handleClose();
    }

    // SSE Stream
    if (method === "GET" && path === "/stream") {
      return this.handleStream();
    }

    // Export data
    if (method === "GET" && path === "/export") {
      return this.handleExport();
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * セッション初期化ハンドラ
   *
   * 新規投票セッションを作成し、Durable Objectストレージに保存します。
   * 24時間後に自動削除されるアラームも設定します。
   *
   * @param request - セッション作成リクエスト（質問、投票タイプ、選択肢を含む）
   * @returns 作成されたセッション情報
   */
  async handleInit(request: Request): Promise<Response> {
    const body = (await request.json()) as CreateSessionRequest & {
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
      status: "active",
      createdAt: new Date(),
    };

    await this.state.storage.put("session", session);
    // Set alarm to delete after 24 hours
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);

    return new Response(JSON.stringify(session), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * セッション情報取得ハンドラ
   *
   * セッションの詳細情報を取得し、投票者の投票状況に応じて
   * canVoteフラグとメッセージを付与します。
   *
   * @param request - セッション取得リクエスト（voterTokenをクエリパラメータに含む場合あり）
   * @returns セッション情報、または404エラー
   */
  async handleGetSession(request: Request): Promise<Response> {
    const session = await this.state.storage.get<Session>("session");
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }

    // Check if user has voted
    const url = new URL(request.url);
    const voterToken = url.searchParams.get("voterToken");
    let hasVoted = false;
    if (voterToken) {
      hasVoted = (await this.state.storage.get<boolean>(`voter:${voterToken}`)) || false;
    }

    const response = {
      ...session,
      canVote: session.status === "active" && !hasVoted,
      message:
        session.status === "closed"
          ? "投票は終了しました"
          : hasVoted
            ? "既に投票済みです"
            : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * 投票送信ハンドラ
   *
   * 投票リクエストを検証し、票数を更新します。
   * バリデーション後、選択された選択肢の票数を増加させ、
   * SSEで接続中のクライアントに更新を配信します。
   *
   * @param request - 投票リクエスト（choiceIdsとvoterTokenを含む）
   * @returns 投票完了メッセージ、またはエラーレスポンス
   */
  async handleVote(request: Request): Promise<Response> {
    const session = await this.state.storage.get<Session>("session");
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }

    if (session.status === "closed") {
      return new Response(JSON.stringify({ error: "投票は終了しました" }), { status: 403 });
    }

    const body = (await request.json()) as SubmitVoteRequest & {
      voterToken: string;
    };
    const { choiceIds, voterToken } = body;

    if (!voterToken) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    // VAL-06: choiceIdsが配列でない場合は不正
    if (!Array.isArray(choiceIds)) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    // VAL-01: single選択で複数のchoiceIdsは不正
    if (session.voteType === "single" && choiceIds.length > 1) {
      return new Response(
        JSON.stringify({
          error: "単一選択では1つだけ選んでください",
        }),
        { status: 400 },
      );
    }

    // VAL-04: choiceIdsに重複がある場合は不正
    if (new Set(choiceIds).size !== choiceIds.length) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    // VAL-03: 空配列は不正
    if (choiceIds.length === 0) {
      return new Response(JSON.stringify({ error: "選択肢を選んでください" }), { status: 400 });
    }

    // VAL-05: 存在しないchoiceIdを含む場合は不正
    const validChoiceIds = session.choices.map((c) => c.choiceId);
    if (!choiceIds.every((id) => validChoiceIds.includes(id))) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    const hasVoted = await this.state.storage.get<boolean>(`voter:${voterToken}`);
    if (hasVoted) {
      return new Response(JSON.stringify({ error: "既に投票済みです" }), { status: 409 });
    }

    // Update vote counts
    session.choices = session.choices.map((c) => {
      if (choiceIds.includes(c.choiceId)) {
        return { ...c, voteCount: c.voteCount + 1 };
      }
      return c;
    });

    // Save session and voter record
    await this.state.storage.put("session", session);
    await this.state.storage.put(`voter:${voterToken}`, true);

    // Broadcast update
    this.broadcast({ event: "update", data: session });

    return new Response(JSON.stringify({ message: "投票が完了しました" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * セッション終了ハンドラ
   *
   * セッションを終了状態にし、以降の投票を受け付けないようにします。
   * SSEで接続中のクライアントに終了通知を配信します。
   *
   * @returns 更新されたセッション情報、または404エラー
   */
  async handleClose(): Promise<Response> {
    const session = await this.state.storage.get<Session>("session");
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }

    session.status = "closed";
    session.closedAt = new Date();
    await this.state.storage.put("session", session);

    this.broadcast({
      event: "closed",
      data: { message: "投票が終了しました" },
    });

    return new Response(JSON.stringify(session), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * データエクスポートハンドラ
   *
   * セッションの現在の状態をJSON形式で返します。
   *
   * @returns セッションデータ、または404エラー
   */
  async handleExport(): Promise<Response> {
    const session = await this.state.storage.get<Session>("session");
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(session), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Server-Sent Events (SSE) ストリームハンドラ
   *
   * クライアントとのSSE接続を確立し、リアルタイム更新を配信します。
   * 接続時に現在のセッション状態を初期イベントとして送信します。
   *
   * @returns SSEストリームレスポンス
   */
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
    this.state.storage.get<Session>("session").then((session: Session | undefined) => {
      if (session) {
        const payload = { event: "init", data: session };
        const data = `data: ${JSON.stringify(payload)}\n\n`;
        try {
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          // Ignore if stream is closed
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  /**
   * 接続中のすべてのSSEクライアントにメッセージをブロードキャストします
   *
   * @param message - ブロードキャストするメッセージ（イベント名とデータを含む）
   */
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

  /**
   * アラームハンドラ（24時間後に自動実行）
   *
   * セッション作成時に設定されたアラームが発火すると、
   * すべてのストレージデータを削除してリソースを開放します。
   */
  async alarm() {
    // Delete all data
    await this.state.storage.deleteAll();
  }
}
