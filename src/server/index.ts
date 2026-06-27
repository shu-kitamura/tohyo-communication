import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { RoomEventsDO } from "../durable-objects/room-events";
import {
  createHostSessionRequestSchema,
  createQuestionRequestSchema,
  createRoomRequestSchema,
  publicConfigResponseSchema,
  submitVoteRequestSchema,
} from "../shared/api";
import { snapshotForAudience } from "../shared/room-snapshot";
import {
  createHostSession,
  createVoterKeyHash,
  getAnonymousSessionToken,
  getHostSessionToken,
  getOrCreateAnonymousSession,
  hashAdminPassword,
  setAnonymousSessionCookie,
  setHostSessionCookie,
  sha256,
  verifyAdminPassword,
} from "./auth";
import { deleteExpiredRooms } from "./retention";
import { getHostRoom, getRoomSnapshot, notifyRoomSnapshot } from "./rooms";
import {
  createIpRateLimitKey,
  createRoomActorRateLimitKey,
  enforceRateLimit,
  getClientAddress,
  limitJsonBody,
  requireJsonContentType,
  requireSameOriginMutation,
} from "./security";
import { verifyCreateRoomTurnstile } from "./turnstile";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();
const validationHook = (
  result: {
    success: boolean;
    error?: { issues: Array<{ message: string }> };
  },
  c: Context,
) => {
  if (!result.success) {
    return c.json(
      {
        error: result.error?.issues[0]?.message ?? "入力内容を確認してください。",
        code: "validation_error",
      },
      400,
    );
  }
};

const roomParamsSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

const questionParamsSchema = roomParamsSchema.extend({
  questionId: z.string().uuid(),
});

app.use("/api/*", requireSameOriginMutation);
app.use("/api/*", async (c, next) => {
  const rateLimitedResponse = await enforceRateLimit(
    c,
    c.env.PUBLIC_API_RATE_LIMITER,
    createIpRateLimitKey(c),
    "public_api",
  );

  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  await next();
});

app.get("/api/public-config", (c) => {
  const parsed = publicConfigResponseSchema.safeParse({
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
  });

  if (!parsed.success) {
    console.error("TURNSTILE_SITE_KEY is not configured");
    return c.json(
      {
        error: "セキュリティ設定を読み込めませんでした。",
        code: "security_config_unavailable",
      },
      503,
    );
  }

  return c.json(parsed.data);
});

app.get("/api/health", async (c) => {
  const rateLimitedResponse = await enforceRateLimit(
    c,
    c.env.ROOM_READ_RATE_LIMITER,
    `health:${createIpRateLimitKey(c)}`,
    "health",
  );

  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  const database = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  return c.json({
    status: "ok",
    database: database?.ok === 1 ? "connected" : "unavailable",
    runtime: "cloudflare-workers",
  });
});

app.post(
  "/api/rooms",
  limitJsonBody,
  requireJsonContentType,
  zValidator("json", createRoomRequestSchema, validationHook),
  async (c) => {
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.CREATE_ROOM_RATE_LIMITER,
      createIpRateLimitKey(c),
      "create_room",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    const { adminPassword, title, turnstileToken } = c.req.valid("json");

    if (c.env.TEST_BYPASS_TURNSTILE !== "true") {
      if (!c.env.TURNSTILE_SECRET_KEY) {
        console.error("TURNSTILE_SECRET_KEY is not configured");
        return c.json(
          {
            error: "セキュリティ確認を利用できません。しばらく待ってから再度お試しください。",
            code: "turnstile_unavailable",
          },
          503,
        );
      }

      const turnstileResult = await verifyCreateRoomTurnstile(
        c.env.TURNSTILE_SECRET_KEY,
        turnstileToken,
        getClientAddress(c),
        new URL(c.req.url).hostname,
      );

      if (turnstileResult.status === "invalid") {
        console.warn("Turnstile verification failed", {
          errorCodes: turnstileResult.errorCodes,
        });
        return c.json(
          {
            error: "セキュリティ確認に失敗しました。もう一度お試しください。",
            code: "turnstile_failed",
          },
          400,
        );
      }

      if (turnstileResult.status === "unavailable") {
        return c.json(
          {
            error: "セキュリティ確認を利用できません。しばらく待ってから再度お試しください。",
            code: "turnstile_unavailable",
          },
          503,
        );
      }
    }

    const roomId = crypto.randomUUID();
    const now = new Date().toISOString();
    const [adminPasswordHash, hostSession] = await Promise.all([
      hashAdminPassword(adminPassword),
      createHostSession(),
    ]);

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO rooms (
         id, title, status, admin_password_hash, state_version, created_at, updated_at
       ) VALUES (?, ?, 'open', ?, 1, ?, ?)`,
      ).bind(roomId, title, adminPasswordHash, now, now),
      c.env.DB.prepare(
        `INSERT INTO host_sessions (
         id, room_id, token_hash, created_at, expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
      ).bind(
        hostSession.id,
        roomId,
        hostSession.tokenHash,
        hostSession.createdAt,
        hostSession.expiresAt,
      ),
    ]);

    setHostSessionCookie(c, roomId, hostSession.token);

    return c.json(
      {
        roomId,
        title,
        hostUrl: `/rooms/${roomId}`,
        participantUrl: `/rooms/${roomId}`,
      },
      201,
    );
  },
);

app.get(
  "/api/rooms/:roomId/viewer",
  zValidator("param", roomParamsSchema, validationHook),
  async (c) => {
    const { roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.ROOM_READ_RATE_LIMITER,
      `${roomId}:${await createRoomActorRateLimitKey(c, roomId)}`,
      "room_viewer",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    const room = await c.env.DB.prepare("SELECT id FROM rooms WHERE id = ?")
      .bind(roomId)
      .first<{ id: string }>();

    if (!room) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    return c.json({
      viewerRole: (await isAuthorizedHost(c, roomId)) ? "host" : "guest",
    });
  },
);

app.get("/api/rooms/:roomId", zValidator("param", roomParamsSchema, validationHook), async (c) => {
  const { roomId } = c.req.valid("param");
  const anonymousSession = getOrCreateAnonymousSession(c, roomId);
  const voterKeyHash = await createVoterKeyHash(roomId, anonymousSession.token);
  const rateLimitedResponse = await enforceRateLimit(
    c,
    c.env.ROOM_READ_RATE_LIMITER,
    anonymousSession.isNew
      ? `${roomId}:${createIpRateLimitKey(c)}`
      : `${roomId}:participant:${voterKeyHash}`,
    "participant_room",
  );

  if (rateLimitedResponse) {
    if (anonymousSession.isNew) {
      setAnonymousSessionCookie(c, roomId, anonymousSession.token);
    }

    return rateLimitedResponse;
  }

  const roomState = await getRoomSnapshot(c.env.DB, roomId);

  if (!roomState) {
    return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
  }

  const votedQuestionIds = await getVotedQuestionIds(c.env.DB, roomId, voterKeyHash);

  if (anonymousSession.isNew) {
    setAnonymousSessionCookie(c, roomId, anonymousSession.token);
  }

  return c.json({
    title: roomState.title,
    snapshot: snapshotForAudience(roomState.snapshot, "participant", votedQuestionIds),
    votedQuestionIds,
  });
});

app.post(
  "/api/rooms/:roomId/host-session",
  zValidator("param", roomParamsSchema, validationHook),
  limitJsonBody,
  requireJsonContentType,
  zValidator("json", createHostSessionRequestSchema, validationHook),
  async (c) => {
    const { roomId } = c.req.valid("param");
    const { adminPassword } = c.req.valid("json");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.HOST_SESSION_RATE_LIMITER,
      `${roomId}:${createIpRateLimitKey(c)}`,
      "host_session",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    const room = await c.env.DB.prepare(
      `SELECT admin_password_hash AS adminPasswordHash
       FROM rooms
       WHERE id = ?`,
    )
      .bind(roomId)
      .first<{ adminPasswordHash: string }>();

    if (!room) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    if (!(await verifyAdminPassword(adminPassword, room.adminPasswordHash))) {
      return c.json(
        {
          error: "管理パスワードが違います。",
          code: "invalid_admin_password",
        },
        401,
      );
    }

    const hostSession = await createHostSession();

    await c.env.DB.prepare(
      `INSERT INTO host_sessions (
         id, room_id, token_hash, created_at, expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        hostSession.id,
        roomId,
        hostSession.tokenHash,
        hostSession.createdAt,
        hostSession.expiresAt,
      )
      .run();

    setHostSessionCookie(c, roomId, hostSession.token);

    return c.json({ viewerRole: "host" }, 201);
  },
);

app.get(
  "/api/rooms/:roomId/host",
  zValidator("param", roomParamsSchema, validationHook),
  async (c) => {
    const { roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.ROOM_READ_RATE_LIMITER,
      `${roomId}:${await createRoomActorRateLimitKey(c, roomId)}`,
      "host_room",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    if (!(await isAuthorizedHost(c, roomId))) {
      return c.json({ error: "ホストセッションが必要です。", code: "host_auth_required" }, 401);
    }

    const room = await getHostRoom(c.env.DB, roomId);

    if (!room) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    return c.json(room);
  },
);

app.post(
  "/api/rooms/:roomId/close",
  zValidator("param", roomParamsSchema, validationHook),
  async (c) => {
    const { roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.HOST_MUTATION_RATE_LIMITER,
      `${roomId}:${createIpRateLimitKey(c)}`,
      "close_room",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    if (!(await isAuthorizedHost(c, roomId))) {
      return c.json({ error: "ホストセッションが必要です。", code: "host_auth_required" }, 401);
    }

    const now = new Date().toISOString();
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE questions
         SET status = 'closed', closed_at = ?, updated_at = ?
         WHERE room_id = ?
           AND status = 'active'
           AND EXISTS (
             SELECT 1 FROM rooms WHERE id = ? AND status = 'open'
           )`,
      ).bind(now, now, roomId, roomId),
      c.env.DB.prepare(
        `UPDATE rooms
         SET status = 'closed',
             closed_at = ?,
             state_version = state_version + 1,
             updated_at = ?
         WHERE id = ? AND status = 'open'`,
      ).bind(now, now, roomId),
    ]);

    if (results[1].meta.changes !== 1) {
      const room = await c.env.DB.prepare("SELECT status FROM rooms WHERE id = ?")
        .bind(roomId)
        .first<{ status: "open" | "closed" }>();

      if (!room) {
        return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
      }

      return c.json(
        {
          error: "このルームはすでに終了しています。",
          code: "room_already_closed",
        },
        409,
      );
    }

    const roomState = await getRoomSnapshot(c.env.DB, roomId);

    if (!roomState) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    await notifyRoomSnapshot(c.env, roomState.snapshot);

    return c.json({ snapshot: roomState.snapshot });
  },
);

app.post(
  "/api/rooms/:roomId/questions",
  zValidator("param", roomParamsSchema, validationHook),
  limitJsonBody,
  requireJsonContentType,
  zValidator("json", createQuestionRequestSchema, validationHook),
  async (c) => {
    const { roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.HOST_MUTATION_RATE_LIMITER,
      `${roomId}:${createIpRateLimitKey(c)}`,
      "create_question",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    if (!(await isAuthorizedHost(c, roomId))) {
      return c.json({ error: "ホストセッションが必要です。", code: "host_auth_required" }, 401);
    }

    const question = c.req.valid("json");
    const questionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const maxChoices = question.questionType === "single" ? 1 : question.options.length;

    const statements = [
      c.env.DB.prepare(
        `INSERT INTO questions (
           id,
           room_id,
           title,
           question_type,
           status,
           min_choices,
           max_choices,
           sort_order,
           created_at,
           updated_at
         )
         SELECT
           ?,
           id,
           ?,
           ?,
           'draft',
           1,
           ?,
           COALESCE((SELECT MAX(sort_order) FROM questions WHERE room_id = ?), -1) + 1,
           ?,
           ?
         FROM rooms
         WHERE id = ? AND status = 'open'`,
      ).bind(
        questionId,
        question.title,
        question.questionType,
        maxChoices,
        roomId,
        now,
        now,
        roomId,
      ),
      ...question.options.map((label, sortOrder) =>
        c.env.DB.prepare(
          `INSERT INTO options (
             id, question_id, label, sort_order, is_enabled, created_at, updated_at
           )
           SELECT ?, id, ?, ?, 1, ?, ?
           FROM questions
           WHERE id = ? AND room_id = ?`,
        ).bind(crypto.randomUUID(), label, sortOrder, now, now, questionId, roomId),
      ),
      c.env.DB.prepare(
        `UPDATE rooms
         SET state_version = state_version + 1, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM questions WHERE id = ? AND room_id = ?
           )`,
      ).bind(now, roomId, questionId, roomId),
    ];

    const results = await c.env.DB.batch(statements);

    if (results[0].meta.changes !== 1) {
      return c.json({ error: "終了したルームには質問を追加できません。" }, 409);
    }

    const [hostRoom, roomState] = await Promise.all([
      getHostRoom(c.env.DB, roomId),
      getRoomSnapshot(c.env.DB, roomId),
    ]);

    if (!hostRoom || !roomState) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    await notifyRoomSnapshot(c.env, roomState.snapshot);

    return c.json(
      {
        question: hostRoom.questions.find((item) => item.id === questionId),
      },
      201,
    );
  },
);

app.post(
  "/api/rooms/:roomId/questions/:questionId/start",
  zValidator("param", questionParamsSchema, validationHook),
  async (c) => {
    const { questionId, roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.HOST_MUTATION_RATE_LIMITER,
      `${roomId}:${createIpRateLimitKey(c)}`,
      "start_question",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    if (!(await isAuthorizedHost(c, roomId))) {
      return c.json({ error: "ホストセッションが必要です。", code: "host_auth_required" }, 401);
    }

    const now = new Date().toISOString();

    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE questions
         SET status = 'active', opened_at = ?, updated_at = ?
         WHERE id = ?
           AND room_id = ?
           AND status = 'draft'
           AND EXISTS (
             SELECT 1 FROM rooms WHERE id = ? AND status = 'open'
           )`,
      ).bind(now, now, questionId, roomId, roomId),
      c.env.DB.prepare(
        `UPDATE rooms
         SET state_version = state_version + 1, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1
             FROM questions
             WHERE id = ? AND room_id = ? AND status = 'active' AND opened_at = ?
           )`,
      ).bind(now, roomId, questionId, roomId, now),
    ]);

    if (results[0].meta.changes !== 1) {
      return c.json(
        {
          error: "下書きの質問だけ開始できます。",
          code: "question_not_startable",
        },
        409,
      );
    }

    const roomState = await getRoomSnapshot(c.env.DB, roomId);

    if (!roomState) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    await notifyRoomSnapshot(c.env, roomState.snapshot);

    return c.json({ snapshot: roomState.snapshot });
  },
);

app.post(
  "/api/rooms/:roomId/questions/:questionId/close",
  zValidator("param", questionParamsSchema, validationHook),
  async (c) => {
    const { questionId, roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.HOST_MUTATION_RATE_LIMITER,
      `${roomId}:${createIpRateLimitKey(c)}`,
      "close_question",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    if (!(await isAuthorizedHost(c, roomId))) {
      return c.json({ error: "ホストセッションが必要です。", code: "host_auth_required" }, 401);
    }

    const now = new Date().toISOString();
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE questions
         SET status = 'closed', closed_at = ?, updated_at = ?
         WHERE id = ?
           AND room_id = ?
           AND status = 'active'
           AND EXISTS (
             SELECT 1 FROM rooms WHERE id = ? AND status = 'open'
           )`,
      ).bind(now, now, questionId, roomId, roomId),
      c.env.DB.prepare(
        `UPDATE rooms
         SET state_version = state_version + 1, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1
             FROM questions
             WHERE id = ? AND room_id = ? AND status = 'closed' AND closed_at = ?
           )`,
      ).bind(now, roomId, questionId, roomId, now),
    ]);

    if (results[0].meta.changes !== 1) {
      return c.json(
        {
          error: "投票受付中の質問だけ終了できます。",
          code: "question_not_closable",
        },
        409,
      );
    }

    const roomState = await getRoomSnapshot(c.env.DB, roomId);

    if (!roomState) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    await notifyRoomSnapshot(c.env, roomState.snapshot);

    return c.json({ snapshot: roomState.snapshot });
  },
);

app.post(
  "/api/rooms/:roomId/questions/:questionId/votes",
  zValidator("param", questionParamsSchema, validationHook),
  limitJsonBody,
  requireJsonContentType,
  zValidator("json", submitVoteRequestSchema, validationHook),
  async (c) => {
    const { questionId, roomId } = c.req.valid("param");
    const { optionIds } = c.req.valid("json");
    const anonymousSession = getOrCreateAnonymousSession(c, roomId);
    const voterKeyHash = await createVoterKeyHash(roomId, anonymousSession.token);
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.VOTE_RATE_LIMITER,
      anonymousSession.isNew
        ? `${roomId}:${createIpRateLimitKey(c)}`
        : `${roomId}:participant:${voterKeyHash}`,
      "submit_vote",
    );

    if (rateLimitedResponse) {
      if (anonymousSession.isNew) {
        setAnonymousSessionCookie(c, roomId, anonymousSession.token);
      }

      return rateLimitedResponse;
    }

    const question = await c.env.DB.prepare(
      `SELECT
         q.id,
         q.question_type AS questionType,
         q.min_choices AS minChoices,
         q.max_choices AS maxChoices,
         q.status,
         r.status AS roomStatus
       FROM questions q
       INNER JOIN rooms r ON r.id = q.room_id
       WHERE q.id = ? AND q.room_id = ?`,
    )
      .bind(questionId, roomId)
      .first<{
        id: string;
        questionType: "single" | "multiple";
        minChoices: number;
        maxChoices: number;
        status: "draft" | "active" | "closed";
        roomStatus: "open" | "closed";
      }>();

    if (!question) {
      return c.json({ error: "質問が見つかりません。", code: "question_not_found" }, 404);
    }

    if (question.roomStatus !== "open" || question.status !== "active") {
      return c.json({ error: "この質問は投票を受け付けていません。" }, 409);
    }

    if (optionIds.length < question.minChoices || optionIds.length > question.maxChoices) {
      return c.json(
        {
          error:
            question.questionType === "single"
              ? "選択肢を1つ選んでください。"
              : `${question.minChoices}〜${question.maxChoices}件を選んでください。`,
          code: "invalid_choice_count",
        },
        400,
      );
    }

    const placeholders = optionIds.map(() => "?").join(", ");
    const validOptions = await c.env.DB.prepare(
      `SELECT id
       FROM options
       WHERE question_id = ? AND is_enabled = 1 AND id IN (${placeholders})`,
    )
      .bind(questionId, ...optionIds)
      .all<{ id: string }>();

    if (validOptions.results.length !== optionIds.length) {
      return c.json(
        {
          error: "無効な選択肢が含まれています。",
          code: "invalid_option",
        },
        400,
      );
    }

    const voteId = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements = [
      c.env.DB.prepare(
        `INSERT INTO votes (id, question_id, voter_key_hash, created_at)
         SELECT ?, q.id, ?, ?
         FROM questions q
         INNER JOIN rooms r ON r.id = q.room_id
         WHERE q.id = ?
           AND q.room_id = ?
           AND q.status = 'active'
           AND r.status = 'open'`,
      ).bind(voteId, voterKeyHash, now, questionId, roomId),
      ...optionIds.map((optionId) =>
        c.env.DB.prepare(
          `INSERT INTO vote_choices (vote_id, question_id, option_id, created_at)
           SELECT v.id, v.question_id, o.id, ?
           FROM votes v
           INNER JOIN options o
             ON o.question_id = v.question_id AND o.id = ? AND o.is_enabled = 1
           WHERE v.id = ? AND v.question_id = ?`,
        ).bind(now, optionId, voteId, questionId),
      ),
      c.env.DB.prepare(
        `UPDATE rooms
         SET state_version = state_version + 1, updated_at = ?
         WHERE id = ? AND EXISTS (SELECT 1 FROM votes WHERE id = ?)`,
      ).bind(now, roomId, voteId),
    ];

    try {
      const results = await c.env.DB.batch(statements);

      if (results[0].meta.changes !== 1) {
        return c.json(
          {
            error: "投票受付が終了しました。",
            code: "question_not_active",
          },
          409,
        );
      }
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            error: "この質問にはすでに投票済みです。",
            code: "already_voted",
          },
          409,
        );
      }

      throw error;
    }

    const roomState = await getRoomSnapshot(c.env.DB, roomId);

    if (!roomState) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    setAnonymousSessionCookie(c, roomId, anonymousSession.token);
    await notifyRoomSnapshot(c.env, roomState.snapshot);
    const votedQuestionIds = await getVotedQuestionIds(c.env.DB, roomId, voterKeyHash);

    return c.json(
      {
        message: "投票を受け付けました。",
        snapshot: snapshotForAudience(roomState.snapshot, "participant", votedQuestionIds),
        votedQuestionIds,
      },
      201,
    );
  },
);

app.get(
  "/api/rooms/:roomId/events",
  zValidator("param", roomParamsSchema, validationHook),
  async (c) => {
    const { roomId } = c.req.valid("param");
    const rateLimitedResponse = await enforceRateLimit(
      c,
      c.env.ROOM_EVENTS_RATE_LIMITER,
      `${roomId}:${await createRoomActorRateLimitKey(c, roomId)}`,
      "room_events",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    const roomState = await getRoomSnapshot(c.env.DB, roomId);

    if (!roomState) {
      return c.json({ error: "ルームが見つかりません。", code: "room_not_found" }, 404);
    }

    await notifyRoomSnapshot(c.env, roomState.snapshot);

    const hostSession = await getAuthorizedHostSession(c, roomId);
    const audience = hostSession ? "host" : "participant";
    const visibleResultQuestionIds =
      audience === "participant" ? await getParticipantVotedQuestionIds(c, roomId) : [];
    const roomEvents = c.env.ROOM_EVENTS.getByName(roomId);
    const eventsUrl = new URL("https://room-events/events");
    eventsUrl.searchParams.set("audience", audience);

    if (hostSession) {
      eventsUrl.searchParams.set("hostSessionExpiresAt", hostSession.expiresAt);
    }

    for (const questionId of visibleResultQuestionIds) {
      eventsUrl.searchParams.append("visibleResultQuestionId", questionId);
    }

    return roomEvents.fetch(eventsUrl, {
      headers: c.req.raw.headers,
      signal: c.req.raw.signal,
    });
  },
);

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((error, c) => {
  console.error("Unhandled request error", error);
  return c.json({ error: "サーバーエラーが発生しました。" }, 500);
});

async function isAuthorizedHost(c: AppContext, roomId: string): Promise<boolean> {
  return Boolean(await getAuthorizedHostSession(c, roomId));
}

async function getAuthorizedHostSession(
  c: AppContext,
  roomId: string,
): Promise<{ id: string; expiresAt: string } | null> {
  const token = getHostSessionToken(c, roomId);

  if (!token) {
    return null;
  }

  const tokenHash = await sha256(token);
  const session = await c.env.DB.prepare(
    `SELECT id, expires_at AS expiresAt
     FROM host_sessions
     WHERE room_id = ?
       AND token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > ?
     LIMIT 1`,
  )
    .bind(roomId, tokenHash, new Date().toISOString())
    .first<{ id: string; expiresAt: string }>();

  return session ?? null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

async function getVotedQuestionIds(
  database: D1Database,
  roomId: string,
  voterKeyHash: string,
): Promise<string[]> {
  const votes = await database
    .prepare(
      `SELECT v.question_id AS questionId
       FROM votes v
       INNER JOIN questions q ON q.id = v.question_id
       WHERE q.room_id = ? AND v.voter_key_hash = ?
       ORDER BY q.sort_order ASC`,
    )
    .bind(roomId, voterKeyHash)
    .all<{ questionId: string }>();

  return votes.results.map((vote) => vote.questionId);
}

async function getParticipantVotedQuestionIds(c: AppContext, roomId: string): Promise<string[]> {
  const anonymousToken = getAnonymousSessionToken(c, roomId);

  if (!anonymousToken) {
    return [];
  }

  const voterKeyHash = await createVoterKeyHash(roomId, anonymousToken);
  return getVotedQuestionIds(c.env.DB, roomId, voterKeyHash);
}

export { RoomEventsDO };

export default {
  fetch: app.fetch,
  scheduled(controller, env, context) {
    context.waitUntil(deleteExpiredRooms(env.DB, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
