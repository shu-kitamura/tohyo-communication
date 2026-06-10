import { describe, expect, it } from "vitest";

import { verifyCreateRoomTurnstile } from "../../src/server/turnstile";

describe("Turnstile verification", () => {
  it("accepts a response with the expected action and hostname", async () => {
    const result = await verifyCreateRoomTurnstile(
      "secret",
      "token",
      "203.0.113.1",
      "example.com",
      createFetcher({
        success: true,
        action: "create_room",
        hostname: "example.com",
      }),
    );

    expect(result).toEqual({ status: "valid" });
  });

  it("rejects a response for a different action", async () => {
    const result = await verifyCreateRoomTurnstile(
      "secret",
      "token",
      undefined,
      "example.com",
      createFetcher({
        success: true,
        action: "other_action",
        hostname: "example.com",
      }),
    );

    expect(result).toEqual({ status: "invalid", errorCodes: [] });
  });

  it("rejects a response for a different hostname", async () => {
    const result = await verifyCreateRoomTurnstile(
      "secret",
      "token",
      undefined,
      "example.com",
      createFetcher({
        success: true,
        action: "create_room",
        hostname: "attacker.example",
      }),
    );

    expect(result).toEqual({ status: "invalid", errorCodes: [] });
  });

  it("reports the service as unavailable when verification fails", async () => {
    const fetcher = (() => Promise.reject(new Error("network error"))) as typeof fetch;
    const result = await verifyCreateRoomTurnstile(
      "secret",
      "token",
      undefined,
      "example.com",
      fetcher,
    );

    expect(result).toEqual({ status: "unavailable" });
  });
});

function createFetcher(body: Record<string, unknown>): typeof fetch {
  return (() => Promise.resolve(Response.json(body))) as typeof fetch;
}
