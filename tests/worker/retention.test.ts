import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { CLOSED_ROOM_RETENTION_DAYS, deleteExpiredRooms } from "../../src/server/retention";

interface TestEnv extends Env {
  TEST_MIGRATIONS: Array<{
    name: string;
    queries: string[];
  }>;
}

const testEnv = env as TestEnv;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

describe("room retention", () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
  });

  it("deletes expired closed rooms and cascades all related data", async () => {
    const scheduledTime = Date.UTC(2026, 5, 9, 18);
    const expiredClosedAt = new Date(
      scheduledTime - (CLOSED_ROOM_RETENTION_DAYS + 1) * DAY_IN_MILLISECONDS,
    ).toISOString();
    const retainedClosedAt = new Date(
      scheduledTime - (CLOSED_ROOM_RETENTION_DAYS - 1) * DAY_IN_MILLISECONDS,
    ).toISOString();
    const createdAt = new Date(scheduledTime - 60 * DAY_IN_MILLISECONDS).toISOString();
    const expiresAt = new Date(scheduledTime + DAY_IN_MILLISECONDS).toISOString();

    await testEnv.DB.batch([
      testEnv.DB.prepare(
        `INSERT INTO rooms (
           id, title, status, admin_password_hash, state_version, created_at, updated_at, closed_at
         ) VALUES
           ('expired-room', '削除対象', 'closed', 'hash', 2, ?, ?, ?),
           ('retained-room', '保持対象', 'closed', 'hash', 2, ?, ?, ?),
           ('open-room', '未終了', 'open', 'hash', 1, ?, ?, NULL)`,
      ).bind(
        createdAt,
        expiredClosedAt,
        expiredClosedAt,
        createdAt,
        retainedClosedAt,
        retainedClosedAt,
        createdAt,
        createdAt,
      ),
      testEnv.DB.prepare(
        `INSERT INTO host_sessions (
           id, room_id, token_hash, created_at, expires_at
         ) VALUES ('expired-session', 'expired-room', 'expired-token', ?, ?)`,
      ).bind(createdAt, expiresAt),
      testEnv.DB.prepare(
        `INSERT INTO questions (
           id, room_id, title, question_type, status, min_choices, max_choices,
           sort_order, created_at, updated_at, opened_at, closed_at
         ) VALUES (
           'expired-question', 'expired-room', '質問', 'single', 'closed', 1, 1,
           0, ?, ?, ?, ?
         )`,
      ).bind(createdAt, expiredClosedAt, createdAt, expiredClosedAt),
      testEnv.DB.prepare(
        `INSERT INTO options (
           id, question_id, label, sort_order, is_enabled, created_at, updated_at
         ) VALUES ('expired-option', 'expired-question', '選択肢', 0, 1, ?, ?)`,
      ).bind(createdAt, expiredClosedAt),
      testEnv.DB.prepare(
        `INSERT INTO votes (id, question_id, voter_key_hash, created_at)
         VALUES ('expired-vote', 'expired-question', 'expired-voter', ?)`,
      ).bind(createdAt),
      testEnv.DB.prepare(
        `INSERT INTO vote_choices (vote_id, question_id, option_id, created_at)
         VALUES ('expired-vote', 'expired-question', 'expired-option', ?)`,
      ).bind(createdAt),
    ]);

    await expect(deleteExpiredRooms(testEnv.DB, scheduledTime)).resolves.toBe(1);

    const deletedRows = await testEnv.DB.batch([
      testEnv.DB.prepare("SELECT COUNT(*) AS count FROM rooms WHERE id = 'expired-room'"),
      testEnv.DB.prepare(
        "SELECT COUNT(*) AS count FROM host_sessions WHERE id = 'expired-session'",
      ),
      testEnv.DB.prepare("SELECT COUNT(*) AS count FROM questions WHERE id = 'expired-question'"),
      testEnv.DB.prepare("SELECT COUNT(*) AS count FROM options WHERE id = 'expired-option'"),
      testEnv.DB.prepare("SELECT COUNT(*) AS count FROM votes WHERE id = 'expired-vote'"),
      testEnv.DB.prepare(
        "SELECT COUNT(*) AS count FROM vote_choices WHERE vote_id = 'expired-vote'",
      ),
    ]);

    for (const result of deletedRows) {
      expect((result.results[0] as { count: number }).count).toBe(0);
    }

    const remainingRooms = await testEnv.DB.prepare("SELECT id FROM rooms ORDER BY id").all<{
      id: string;
    }>();
    expect(remainingRooms.results.map((room) => room.id)).toEqual(["open-room", "retained-room"]);
  });
});
