import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns the Worker and D1 status", async () => {
    const response = await SELF.fetch("https://example.com/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      database: "connected",
      runtime: "cloudflare-workers",
    });
  });
});
