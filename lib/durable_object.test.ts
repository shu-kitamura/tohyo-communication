import { describe, it, expect, beforeEach, vi } from "vitest";
import { VoteSessionDO } from "./durable_object";
import { Session, CreateSessionRequest, SubmitVoteRequest } from "./types";

// Mock DurableObjectState
class MockDurableObjectState implements DurableObjectState {
  id: DurableObjectId = {} as DurableObjectId;
  private internalStorage = new Map<string, unknown>();
  private alarmTime: number | null = null;

  storage = {
    get: vi.fn(async <T>(key: string): Promise<T | undefined> => {
      return this.internalStorage.get(key) as T | undefined;
    }),
    put: vi.fn(async <T>(key: string, value: T): Promise<void> => {
      this.internalStorage.set(key, value);
    }),
    delete: vi.fn(async (key: string): Promise<boolean> => {
      return this.internalStorage.delete(key);
    }),
    deleteAll: vi.fn(async (): Promise<void> => {
      this.internalStorage.clear();
    }),
    list: vi.fn(),
    transaction: vi.fn(),
    getAlarm: vi.fn(async () => this.alarmTime),
    setAlarm: vi.fn(async (scheduledTime: number | Date) => {
      this.alarmTime = typeof scheduledTime === "number" ? scheduledTime : scheduledTime.getTime();
    }),
    deleteAlarm: vi.fn(),
    sync: vi.fn(),
  } as unknown as DurableObjectStorage;

  blockConcurrencyWhile = vi.fn(async <T>(callback: () => Promise<T>): Promise<T> => {
    return callback();
  });

  waitUntil = vi.fn();
  abort = vi.fn();
  getTags = vi.fn(() => []);
  getMetadata = vi.fn();
  setMetadata = vi.fn();
}

describe("VoteSessionDO", () => {
  let doInstance: VoteSessionDO;
  let mockState: MockDurableObjectState;

  beforeEach(() => {
    mockState = new MockDurableObjectState();
    doInstance = new VoteSessionDO(mockState, {});
  });

  describe("handleInit", () => {
    it("セッションを正常に初期化できる", async () => {
      const request = new Request("http://do/init", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "test-session-1",
          question: "好きな色は？",
          voteType: "single",
          choices: [{ text: "赤" }, { text: "青" }, { text: "緑" }],
        } as CreateSessionRequest & { sessionId: string }),
      });

      const response = await doInstance.handleInit(request);
      expect(response.status).toBe(201);

      const data = (await response.json()) as Session;
      expect(data.sessionId).toBe("test-session-1");
      expect(data.question).toBe("好きな色は？");
      expect(data.voteType).toBe("single");
      expect(data.status).toBe("active");
      expect(data.choices).toHaveLength(3);
      expect(data.choices[0].voteCount).toBe(0);

      // ストレージに保存されているか確認
      expect(mockState.storage.put).toHaveBeenCalledWith("session", expect.any(Object));
      // アラームがセットされているか確認
      expect(mockState.storage.setAlarm).toHaveBeenCalled();
    });

    it("choice IDが正しく設定される", async () => {
      const request = new Request("http://do/init", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "test-session-2",
          question: "テスト質問",
          voteType: "multiple",
          choices: [{ text: "選択肢A" }, { text: "選択肢B" }],
        }),
      });

      const response = await doInstance.handleInit(request);
      const data = (await response.json()) as Session;

      expect(data.choices[0].choiceId).toBe("1");
      expect(data.choices[1].choiceId).toBe("2");
    });
  });

  describe("handleGetSession", () => {
    beforeEach(async () => {
      // セッションを事前に作成
      const session: Session = {
        sessionId: "test-session",
        question: "テスト質問",
        voteType: "single",
        choices: [
          { choiceId: "1", text: "選択肢A", voteCount: 5 },
          { choiceId: "2", text: "選択肢B", voteCount: 3 },
        ],
        status: "active",
        createdAt: new Date(),
      };
      await mockState.storage.put("session", session);
    });

    it("セッション情報を取得できる", async () => {
      const request = new Request("http://do/");
      const response = await doInstance.handleGetSession(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessionId).toBe("test-session");
      expect(data.canVote).toBe(true);
    });

    it("投票済みの場合はcanVoteがfalse", async () => {
      const voterToken = "voter-123";
      await mockState.storage.put(`voter:${voterToken}`, true);

      const request = new Request(`http://do/?voterToken=${voterToken}`);
      const response = await doInstance.handleGetSession(request);

      const data = await response.json();
      expect(data.canVote).toBe(false);
      expect(data.message).toBe("既に投票済みです");
    });

    it("セッションが存在しない場合は404", async () => {
      await mockState.storage.delete("session");

      const request = new Request("http://do/");
      const response = await doInstance.handleGetSession(request);

      expect(response.status).toBe(404);
    });
  });

  describe("handleVote", () => {
    beforeEach(async () => {
      const session: Session = {
        sessionId: "test-session",
        question: "テスト質問",
        voteType: "single",
        choices: [
          { choiceId: "1", text: "選択肢A", voteCount: 0 },
          { choiceId: "2", text: "選択肢B", voteCount: 0 },
        ],
        status: "active",
        createdAt: new Date(),
      };
      await mockState.storage.put("session", session);
    });

    it("投票を正常に受け付ける", async () => {
      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "voter-abc",
        } as SubmitVoteRequest & { voterToken: string }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.message).toBe("投票が完了しました");

      // 投票カウントが増えているか確認
      const session = (await mockState.storage.get("session")) as Session;
      expect(session.choices[0].voteCount).toBe(1);
      expect(session.choices[1].voteCount).toBe(0);

      // 投票記録が保存されているか確認
      const voted = await mockState.storage.get("voter:voter-abc");
      expect(voted).toBe(true);
    });

    it("複数選択の投票を正常に受け付ける", async () => {
      const session = (await mockState.storage.get("session")) as Session;
      session.voteType = "multiple";
      await mockState.storage.put("session", session);

      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1", "2"],
          voterToken: "voter-xyz",
        }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(201);

      const updatedSession = (await mockState.storage.get("session")) as Session;
      expect(updatedSession.choices[0].voteCount).toBe(1);
      expect(updatedSession.choices[1].voteCount).toBe(1);
    });

    it("既に投票済みの場合はエラー", async () => {
      const voterToken = "voter-duplicate";
      await mockState.storage.put(`voter:${voterToken}`, true);

      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: voterToken,
        }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toBe("既に投票済みです");
    });

    it("セッションが閉じている場合はエラー", async () => {
      const session = (await mockState.storage.get("session")) as Session;
      session.status = "closed";
      await mockState.storage.put("session", session);

      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "voter-late",
        }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("投票は終了しました");
    });

    it("voterTokenがない場合はエラー", async () => {
      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
        }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Voter token required");
    });

    it("無効なchoiceIdの場合はエラー", async () => {
      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["999"],
          voterToken: "voter-invalid",
        }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Invalid choices");
    });

    it("セッションが存在しない場合は404", async () => {
      await mockState.storage.delete("session");

      const request = new Request("http://do/vote", {
        method: "POST",
        body: JSON.stringify({
          choiceIds: ["1"],
          voterToken: "voter-nosession",
        }),
      });

      const response = await doInstance.handleVote(request);
      expect(response.status).toBe(404);
    });
  });

  describe("handleClose", () => {
    beforeEach(async () => {
      const session: Session = {
        sessionId: "test-session",
        question: "テスト質問",
        voteType: "single",
        choices: [{ choiceId: "1", text: "選択肢A", voteCount: 5 }],
        status: "active",
        createdAt: new Date(),
      };
      await mockState.storage.put("session", session);
    });

    it("セッションを正常にクローズできる", async () => {
      const response = await doInstance.handleClose();

      expect(response.status).toBe(200);

      const data = (await response.json()) as Session;
      expect(data.status).toBe("closed");
      expect(data.closedAt).toBeDefined();

      // ストレージも更新されているか確認
      const session = (await mockState.storage.get("session")) as Session;
      expect(session.status).toBe("closed");
    });

    it("セッションが存在しない場合は404", async () => {
      await mockState.storage.delete("session");

      const response = await doInstance.handleClose();

      expect(response.status).toBe(404);
    });
  });

  describe("handleExport", () => {
    beforeEach(async () => {
      const session: Session = {
        sessionId: "test-session",
        question: "テスト質問",
        voteType: "single",
        choices: [
          { choiceId: "1", text: "選択肢A", voteCount: 10 },
          { choiceId: "2", text: "選択肢B", voteCount: 5 },
        ],
        status: "closed",
        createdAt: new Date(),
        closedAt: new Date(),
      };
      await mockState.storage.put("session", session);
    });

    it("セッションデータをエクスポートできる", async () => {
      const response = await doInstance.handleExport();

      expect(response.status).toBe(200);
      const data = (await response.json()) as Session;
      expect(data.sessionId).toBe("test-session");
      expect(data.choices).toHaveLength(2);
    });

    it("セッションが存在しない場合は404", async () => {
      await mockState.storage.delete("session");

      const response = await doInstance.handleExport();

      expect(response.status).toBe(404);
    });
  });

  describe("fetch routing", () => {
    it("POSTリクエストを/initにルーティング", async () => {
      const request = new Request("http://do/init", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "route-test",
          question: "テスト",
          voteType: "single",
          choices: [{ text: "A" }],
        }),
      });

      const response = await doInstance.fetch(request);
      expect(response.status).toBe(201);
    });

    it("GETリクエストを/にルーティング", async () => {
      await mockState.storage.put("session", {
        sessionId: "test",
        question: "Q",
        voteType: "single",
        choices: [],
        status: "active",
        createdAt: new Date(),
      } as Session);

      const request = new Request("http://do/");
      const response = await doInstance.fetch(request);
      expect(response.status).toBe(200);
    });

    it("存在しないパスは404", async () => {
      const request = new Request("http://do/invalid");
      const response = await doInstance.fetch(request);
      expect(response.status).toBe(404);
    });
  });

  describe("alarm", () => {
    it("アラーム実行時にすべてのデータを削除", async () => {
      await mockState.storage.put("session", { test: "data" });
      await mockState.storage.put("voter:123", true);

      await doInstance.alarm();

      expect(mockState.storage.deleteAll).toHaveBeenCalled();
    });
  });
});
