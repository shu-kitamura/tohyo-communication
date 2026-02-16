import { GET, POST } from "@/app/api/vote/[sessionId]/route";
import { createRequest } from "@tests/helpers/request";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

jest.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

const mockGetCloudflareContext = getCloudflareContext as jest.Mock;
const mockCookies = cookies as jest.Mock;

const buildEnv = (stub: { fetch: jest.Mock }) => ({
  VOTE_SESSION: {
    idFromName: jest.fn(() => "id"),
    get: jest.fn(() => stub),
  },
});

const setCookieToken = (token?: string) => {
  mockCookies.mockResolvedValue({
    get: jest.fn(() => (token ? { value: token } : undefined)),
  });
};

describe("GET /api/vote/:sessionId", () => {
  it("GET-01: 未投票ならcanVote=true", async () => {
    setCookieToken(undefined);
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessionId: "id",
            question: "Q",
            voteType: "single",
            choices: [],
            status: "active",
            canVote: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.canVote).toBe(true);
    expect(data.message).toBeUndefined();
  });

  it("GET-02: 投票済みならcanVote=false", async () => {
    setCookieToken("token");
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessionId: "id",
            question: "Q",
            voteType: "single",
            choices: [],
            status: "active",
            canVote: false,
            message: "既に投票済みです",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.canVote).toBe(false);
    expect(data.message).toBe("既に投票済みです");
  });

  it("GET-03: 終了済みならcanVote=false", async () => {
    setCookieToken("token");
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessionId: "id",
            question: "Q",
            voteType: "single",
            choices: [],
            status: "closed",
            canVote: false,
            message: "投票は終了しました",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.canVote).toBe(false);
    expect(data.message).toBe("投票は終了しました");
  });

  it("GET-04: 存在しないsessionIdは404", async () => {
    setCookieToken(undefined);
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/unknown");
    const res = await GET(req, {
      params: Promise.resolve({
        sessionId: "unknown",
      }),
    });

    expect(res.status).toBe(404);
  });

  it("GET-05: DO内部エラーは500", async () => {
    setCookieToken(undefined);
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });

    expect(res.status).toBe(500);
  });
});

describe("POST /api/vote/:sessionId", () => {
  it("VOTE-01: 投票成功でCookieが設定される", async () => {
    setCookieToken(undefined);
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "投票が完了しました" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id", {
      method: "POST",
      body: { choiceIds: ["1"] },
    });
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("投票が完了しました");
    expect(res.headers.get("set-cookie")).toContain("voter_token=");
  });

  it("VOTE-02: choiceIdsが無効なら400", async () => {
    setCookieToken("token");
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id", {
      method: "POST",
      body: { choiceIds: ["x"] },
    });
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    expect(res.status).toBe(400);
  });

  it("VOTE-03: 投票済みなら409", async () => {
    setCookieToken("token");
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id", {
      method: "POST",
      body: { choiceIds: ["1"] },
    });
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    expect(res.status).toBe(409);
  });

  it("VOTE-04: 終了後は403", async () => {
    setCookieToken("token");
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id", {
      method: "POST",
      body: { choiceIds: ["1"] },
    });
    const res = await POST(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    expect(res.status).toBe(403);
  });

  it("VOTE-05: 存在しないsessionIdは404", async () => {
    setCookieToken("token");
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/unknown", {
      method: "POST",
      body: { choiceIds: ["1"] },
    });
    const res = await POST(req, {
      params: Promise.resolve({
        sessionId: "unknown",
      }),
    });
    expect(res.status).toBe(404);
  });
});
