import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { enforceRateLimit } from "../../src/server/security";

describe("rate limit", () => {
  it("returns 429 with Retry-After when the limit is exceeded", async () => {
    const limiter = {
      limit: vi.fn().mockResolvedValue({ success: false }),
    } satisfies RateLimit;
    const app = new Hono();

    app.get("/", async (c) => {
      const rateLimitedResponse = await enforceRateLimit(c, limiter, "actor-key", "test");
      return rateLimitedResponse ?? c.text("ok");
    });

    const response = await app.request("https://example.com/");

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
    });
    expect(limiter.limit).toHaveBeenCalledWith({ key: "actor-key" });
  });

  it("fails open when the limiter is unavailable", async () => {
    const limiter = {
      limit: vi.fn().mockRejectedValue(new Error("unavailable")),
    } satisfies RateLimit;
    const app = new Hono();

    app.get("/", async (c) => {
      const rateLimitedResponse = await enforceRateLimit(c, limiter, "actor-key", "test");
      return rateLimitedResponse ?? c.text("ok");
    });

    const response = await app.request("https://example.com/");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("ok");
  });
});
