import { VoteSessionDO } from "@/lib/durable_object";
import type { Session } from "@/lib/types";

const createSession = (overrides: Partial<Session> = {}): Session => ({
  sessionId: "id",
  question: "Q",
  voteType: "single",
  choices: [
    { choiceId: "1", text: "A", voteCount: 0 },
    { choiceId: "2", text: "B", voteCount: 0 },
  ],
  status: "active",
  createdAt: new Date(),
  ...overrides,
});

const createState = (session?: Session) => {
  const store = new Map<string, unknown>();
  if (session) store.set("session", session);
  return {
    storage: {
      get: async (key: string) => store.get(key),
      put: async (key: string, value: unknown) => {
        store.set(key, value);
      },
      setAlarm: jest.fn(async () => {}),
      deleteAll: jest.fn(async () => {
        store.clear();
      }),
    },
  } as unknown as DurableObjectState;
};

const readChunk = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  const { value } = await reader.read();
  if (!value) return "";
  return new TextDecoder().decode(value);
};

describe("VoteSessionDO SSE", () => {
  it("STREAM-01: 接続直後にinitイベントが配信される", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = voteDO.handleStream(new Request("http://do/stream"));
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    await new Promise((r) => setTimeout(r, 0));
    const chunk = await readChunk(reader!);
    expect(chunk).toContain('"event":"init"');
  });

  it("STREAM-02: 投票後にupdateイベントが配信される", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = voteDO.handleStream(new Request("http://do/stream"));
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    await new Promise((r) => setTimeout(r, 0));
    await readChunk(reader!);

    const voteReq = new Request("http://do/vote", {
      method: "POST",
      body: JSON.stringify({
        choiceIds: ["1"],
        voterToken: "token",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const voteRes = await voteDO.fetch(voteReq);
    expect(voteRes.status).toBe(201);

    const updateChunk = await readChunk(reader!);
    expect(updateChunk).toContain('"event":"update"');
  });

  it("STREAM-03: 終了後にclosedイベントが配信される", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = voteDO.handleStream(new Request("http://do/stream"));
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    await new Promise((r) => setTimeout(r, 0));
    await readChunk(reader!);

    const closeReq = new Request("http://do/close", {
      method: "POST",
    });
    const closeRes = await voteDO.fetch(closeReq);
    expect(closeRes.status).toBe(200);

    const closedChunk = await readChunk(reader!);
    expect(closedChunk).toContain('"event":"closed"');
  });
});

describe("VoteSessionDO vote validation", () => {
  it("VOTE-02: choiceIdsが無効なら400", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["999"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("VOTE-03: 投票済みは409", async () => {
    const session = createSession();
    const state = createState(session);
    await state.storage.put("voter:token", true);
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(409);
  });

  it("VOTE-04: 終了後の投票は403", async () => {
    const session = createSession({
      status: "closed",
    });
    const state = createState(session);
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("VOTE-05: セッション未作成なら404", async () => {
    const state = createState();
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("VoteSessionDO choiceIds validation", () => {
  it("VAL-01: type:single で複数選択した場合は400を返す", async () => {
    const session = createSession({ voteType: "single" });
    const state = createState(session);
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1", "2"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("VAL-02: type:single で1つだけ選択した場合は201を返す", async () => {
    const session = createSession({ voteType: "single" });
    const state = createState(session);
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
  });

  it("VAL-03: choiceIds が空配列の場合は400を返す", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: [],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("VAL-04: choiceIds に重複がある場合は400を返す", async () => {
    const session = createSession({ voteType: "multiple" });
    const state = createState(session);
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1", "1"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("VAL-05: 存在しない choiceId を含む場合は400を返す", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["999"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("VAL-06: choiceIds が配列でない場合は400を返す", async () => {
    const state = createState(createSession());
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: "1",
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("VAL-07: type:multiple で複数選択は201を返す", async () => {
    const session = createSession({ voteType: "multiple" });
    const state = createState(session);
    const voteDO = new VoteSessionDO(state, {});

    const res = await voteDO.fetch(
      new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1", "2"],
          voterToken: "token",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
  });
});
