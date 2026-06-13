import {
  roomSnapshotSchema,
  snapshotForAudience,
  type RoomSnapshot,
  type SnapshotAudience,
} from "../shared/room-snapshot";

const encoder = new TextEncoder();
const HEARTBEAT_INTERVAL_MS = 15_000;

interface SseClient {
  audience: SnapshotAudience;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

export class RoomEventsDO implements DurableObject {
  private readonly clients = new Set<SseClient>();
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private snapshot?: RoomSnapshot;

  constructor(
    private readonly state: DurableObjectState,
    env: unknown,
  ) {
    void this.state;
    void env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/events") {
      return this.createEventStream(request, this.readAudience(url));
    }

    if (request.method === "POST" && url.pathname === "/snapshot") {
      return this.updateSnapshot(request);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  private readAudience(url: URL): SnapshotAudience {
    return url.searchParams.get("audience") === "host" ? "host" : "participant";
  }

  private createEventStream(request: Request, audience: SnapshotAudience): Response {
    let client: SseClient | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        client = { audience, controller };
        this.clients.add(client);
        this.startHeartbeat();

        this.enqueue(controller, "retry: 3000\n\n");

        if (this.snapshot) {
          this.sendSnapshot(client, this.snapshot);
        }

        request.signal.addEventListener(
          "abort",
          () => {
            if (client) {
              this.removeClient(client);
            }
          },
          { once: true },
        );
      },
      cancel: () => {
        if (client) {
          this.removeClient(client);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  private async updateSnapshot(request: Request): Promise<Response> {
    const parsed = roomSnapshotSchema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid snapshot",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    if (this.snapshot && parsed.data.stateVersion <= this.snapshot.stateVersion) {
      return Response.json({ applied: false, stateVersion: this.snapshot.stateVersion });
    }

    this.snapshot = parsed.data;
    this.broadcast(parsed.data);

    return Response.json({ applied: true, stateVersion: parsed.data.stateVersion });
  }

  private broadcast(snapshot: RoomSnapshot): void {
    for (const client of this.clients) {
      this.sendSnapshot(client, snapshot);
    }
  }

  private sendSnapshot(client: SseClient, snapshot: RoomSnapshot): void {
    const visibleResultQuestionIds =
      client.audience === "participant" ? Object.keys(snapshot.resultsByQuestion) : [];
    const payload = snapshotForAudience(snapshot, client.audience, visibleResultQuestionIds);
    const message = [
      `id: ${snapshot.stateVersion}`,
      "event: room.snapshot",
      `data: ${JSON.stringify(payload)}`,
      "",
      "",
    ].join("\n");

    if (!this.enqueue(client.controller, message)) {
      this.removeClient(client);
    }
  }

  private enqueue(
    controller: ReadableStreamDefaultController<Uint8Array>,
    message: string,
  ): boolean {
    try {
      controller.enqueue(encoder.encode(message));
      return true;
    } catch {
      return false;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients) {
        if (!this.enqueue(client.controller, ": heartbeat\n\n")) {
          this.removeClient(client);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private removeClient(client: SseClient): void {
    this.clients.delete(client);

    if (this.clients.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
