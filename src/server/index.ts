import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { RoomEventsDO } from "../durable-objects/room-events";

const app = new Hono<{ Bindings: Env }>();

const roomParamsSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

app.get("/api/health", async (c) => {
  const database = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  return c.json({
    status: "ok",
    database: database?.ok === 1 ? "connected" : "unavailable",
    runtime: "cloudflare-workers",
  });
});

app.get("/api/rooms/:roomId/events", zValidator("param", roomParamsSchema), async (c) => {
  const { roomId } = c.req.valid("param");
  const roomEvents = c.env.ROOM_EVENTS.getByName(roomId);

  return roomEvents.fetch("https://room-events/events?audience=participant", {
    headers: c.req.raw.headers,
    signal: c.req.raw.signal,
  });
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export { RoomEventsDO };
export default app;
