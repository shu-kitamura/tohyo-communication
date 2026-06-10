import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

import { mutationRequestHeaderName, mutationRequestHeaderValue } from "../shared/api";
import { createVoterKeyHash, getAnonymousSessionToken, getHostSessionToken, sha256 } from "./auth";

const JSON_BODY_MAX_SIZE_BYTES = 16 * 1024;
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const limitJsonBody = bodyLimit({
  maxSize: JSON_BODY_MAX_SIZE_BYTES,
  onError: (c) =>
    c.json(
      {
        error: "リクエスト本文が大きすぎます。",
        code: "request_body_too_large",
      },
      413,
    ),
});

export const requireJsonContentType: MiddlewareHandler = async (c, next) => {
  const mediaType = c.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    return c.json(
      {
        error: "Content-Typeにはapplication/jsonを指定してください。",
        code: "unsupported_media_type",
      },
      415,
    );
  }

  await next();
};

export const requireSameOriginMutation: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const requestOrigin = c.req.header("Origin");
  const targetOrigin = new URL(c.req.url).origin;
  const secFetchSite = c.req.header("Sec-Fetch-Site");
  const mutationHeader = c.req.header(mutationRequestHeaderName);

  if (
    requestOrigin !== targetOrigin ||
    secFetchSite !== "same-origin" ||
    mutationHeader !== mutationRequestHeaderValue
  ) {
    return c.json(
      {
        error: "許可されていないリクエストです。",
        code: "invalid_request_origin",
      },
      403,
    );
  }

  await next();
};

export function getClientAddress(c: Context): string | undefined {
  const address = c.req.header("CF-Connecting-IP")?.trim();
  return address || undefined;
}

export function createIpRateLimitKey(c: Context): string {
  return `ip:${getClientAddress(c) ?? "unknown"}`;
}

export async function createRoomActorRateLimitKey(c: Context, roomId: string): Promise<string> {
  const hostToken = getHostSessionToken(c, roomId);

  if (hostToken) {
    return `host:${await sha256(hostToken)}`;
  }

  const anonymousToken = getAnonymousSessionToken(c, roomId);

  if (anonymousToken) {
    return `participant:${await createVoterKeyHash(roomId, anonymousToken)}`;
  }

  return createIpRateLimitKey(c);
}

export async function enforceRateLimit(
  c: Context,
  limiter: RateLimit,
  key: string,
  scope: string,
): Promise<Response | null> {
  try {
    const outcome = await limiter.limit({ key });

    if (outcome.success) {
      return null;
    }

    console.warn("Rate limit exceeded", {
      path: c.req.path,
      scope,
    });
    c.header("Retry-After", String(RATE_LIMIT_RETRY_AFTER_SECONDS));

    return c.json(
      {
        error: "リクエストが多すぎます。しばらく待ってから再度お試しください。",
        code: "rate_limited",
      },
      429,
    );
  } catch (error) {
    console.error("Rate limiter failed", {
      error,
      path: c.req.path,
      scope,
    });
    return null;
  }
}
