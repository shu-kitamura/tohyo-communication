import { GET } from "@/app/api/vote/[sessionId]/export/route";
import { createRequest } from "@tests/helpers/request";
import { getCloudflareContext } from "@opennextjs/cloudflare";

jest.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: jest.fn(),
}));

const mockGetCloudflareContext = getCloudflareContext as jest.Mock;

const buildEnv = (stub: { fetch: jest.Mock }) => ({
  VOTE_SESSION: {
    idFromName: jest.fn(() => "id"),
    get: jest.fn(() => stub),
  },
});

const baseSession = {
  sessionId: "id",
  question: "Q",
  voteType: "single",
  choices: [
    { choiceId: "1", text: "A", voteCount: 2 },
    { choiceId: "2", text: "B", voteCount: 1 },
  ],
  status: "active",
  createdAt: new Date().toISOString(),
};

describe("GET /api/vote/:sessionId/export", () => {
  it("EXPORT-01: format=jsonで集計が返る", async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(baseSession), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id/export?format=json");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalVotes).toBe(3);
    expect(data.choices[0].percentage).toBeCloseTo(66.7, 1);
    expect(data.exportedAt).toBeTruthy();
  });

  it("EXPORT-02: format=csvでCSVが返る", async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(baseSession), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id/export?format=csv");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(text.split("\n")[0]).toBe("選択肢,得票数,得票率");
  });

  it("EXPORT-03: format未指定は400", async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(baseSession), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id/export");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    expect(res.status).toBe(400);
  });

  it("EXPORT-04: format=imageは501", async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(baseSession), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id/export?format=image");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    expect(res.status).toBe(501);
  });

  it("EXPORT-05: format不正は400", async () => {
    const stub = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify(baseSession), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    };
    mockGetCloudflareContext.mockResolvedValue({
      env: buildEnv(stub),
    });

    const req = createRequest("http://localhost/api/vote/id/export?format=xml");
    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "id" }),
    });
    expect(res.status).toBe(400);
  });

  it("EXPORT-06: 存在しないsessionIdは404", async () => {
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

    const req = createRequest("http://localhost/api/vote/unknown/export?format=json");
    const res = await GET(req, {
      params: Promise.resolve({
        sessionId: "unknown",
      }),
    });
    expect(res.status).toBe(404);
  });
});
