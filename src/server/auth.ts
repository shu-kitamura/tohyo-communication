import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const HOST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ANONYMOUS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;
const PASSWORD_HASH_ITERATIONS = 100_000;

export interface HostSession {
  id: string;
  token: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export function createHostSession(): Promise<HostSession> {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + HOST_SESSION_MAX_AGE_SECONDS * 1000);
  const token = createRandomToken();

  return sha256(token).then((tokenHash) => ({
    id: crypto.randomUUID(),
    token,
    tokenHash,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }));
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PASSWORD_HASH_ITERATIONS,
    },
    keyMaterial,
    256,
  );

  return [
    "pbkdf2_sha256",
    PASSWORD_HASH_ITERATIONS,
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(hash)),
  ].join("$");
}

export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltText || !hashText) {
    return false;
  }

  const iterations = Number(iterationsText);

  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    return false;
  }

  try {
    const salt = base64ToBytes(saltText);
    const expectedHash = base64ToBytes(hashText);

    if (expectedHash.length === 0) {
      return false;
    }

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const actualHash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations,
      },
      keyMaterial,
      expectedHash.length * 8,
    );

    return constantTimeEqual(new Uint8Array(actualHash), expectedHash);
  } catch {
    return false;
  }
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getHostSessionToken(c: Context, roomId: string): string | undefined {
  return getCookie(c, hostCookieName(roomId));
}

export function getAnonymousSessionToken(c: Context, roomId: string): string | undefined {
  return getCookie(c, anonymousCookieName(roomId));
}

export function setHostSessionCookie(c: Context, roomId: string, token: string): void {
  setCookie(c, hostCookieName(roomId), token, {
    httpOnly: true,
    maxAge: HOST_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}

export function getOrCreateAnonymousSession(
  c: Context,
  roomId: string,
): { token: string; isNew: boolean } {
  const currentToken = getAnonymousSessionToken(c, roomId);

  if (currentToken) {
    return { token: currentToken, isNew: false };
  }

  return { token: createRandomToken(), isNew: true };
}

export function setAnonymousSessionCookie(c: Context, roomId: string, token: string): void {
  setCookie(c, anonymousCookieName(roomId), token, {
    httpOnly: true,
    maxAge: ANONYMOUS_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}

export function createVoterKeyHash(roomId: string, anonymousToken: string): Promise<string> {
  return sha256(`${roomId}:${anonymousToken}`);
}

function hostCookieName(roomId: string): string {
  return `host_session_${roomId}`;
}

function anonymousCookieName(roomId: string): string {
  return `anonymous_session_${roomId}`;
}

function createRandomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return diff === 0;
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
