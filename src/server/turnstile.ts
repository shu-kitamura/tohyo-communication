import { z } from "zod";

import { createRoomTurnstileAction } from "../shared/api";

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 5_000;

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export type TurnstileVerificationResult =
  | { status: "valid" }
  | { status: "invalid"; errorCodes: string[] }
  | { status: "unavailable" };

export async function verifyCreateRoomTurnstile(
  secretKey: string,
  token: string,
  remoteIp: string | undefined,
  expectedHostname: string,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileVerificationResult> {
  const formData = new FormData();
  formData.set("secret", secretKey);
  formData.set("response", token);
  formData.set("idempotency_key", crypto.randomUUID());

  if (remoteIp) {
    formData.set("remoteip", remoteIp);
  }

  try {
    const response = await fetcher(TURNSTILE_SITEVERIFY_URL, {
      body: formData,
      method: "POST",
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const parsed = turnstileResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return { status: "unavailable" };
    }

    if (
      !parsed.data.success ||
      parsed.data.action !== createRoomTurnstileAction ||
      parsed.data.hostname !== expectedHostname
    ) {
      return {
        status: "invalid",
        errorCodes: parsed.data["error-codes"] ?? [],
      };
    }

    return { status: "valid" };
  } catch {
    return { status: "unavailable" };
  }
}
