import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    adminPasswordHash: text("admin_password_hash").notNull(),
    stateVersion: integer("state_version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    check("rooms_status_check", sql`${table.status} IN ('open', 'closed')`),
    check("rooms_state_version_check", sql`${table.stateVersion} >= 1`),
    check(
      "rooms_closed_at_check",
      sql`(${table.status} = 'open' AND ${table.closedAt} IS NULL)
          OR (${table.status} = 'closed' AND ${table.closedAt} IS NOT NULL)`,
    ),
    index("idx_rooms_status").on(table.status),
    index("idx_rooms_created_at").on(table.createdAt),
  ],
);

export const hostSessions = sqliteTable(
  "host_sessions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("uq_host_sessions_token_hash").on(table.tokenHash),
    index("idx_host_sessions_room_created").on(table.roomId, table.createdAt),
    index("idx_host_sessions_expires_at").on(table.expiresAt),
    check("host_sessions_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    questionType: text("question_type", { enum: ["single", "multiple"] }).notNull(),
    status: text("status", { enum: ["draft", "active", "closed"] })
      .notNull()
      .default("draft"),
    minChoices: integer("min_choices").notNull().default(1),
    maxChoices: integer("max_choices").notNull().default(1),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    openedAt: text("opened_at"),
    closedAt: text("closed_at"),
  },
  (table) => [
    check("questions_type_check", sql`${table.questionType} IN ('single', 'multiple')`),
    check("questions_status_check", sql`${table.status} IN ('draft', 'active', 'closed')`),
    check("questions_min_choices_check", sql`${table.minChoices} >= 1`),
    check("questions_max_choices_check", sql`${table.maxChoices} >= ${table.minChoices}`),
    check(
      "questions_single_choices_check",
      sql`${table.questionType} != 'single'
          OR (${table.minChoices} = 1 AND ${table.maxChoices} = 1)`,
    ),
    uniqueIndex("uq_questions_one_active_per_room")
      .on(table.roomId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("uq_questions_room_sort_order").on(table.roomId, table.sortOrder),
    index("idx_questions_room_status").on(table.roomId, table.status),
  ],
);

export const options = sqliteTable(
  "options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("options_sort_order_check", sql`${table.sortOrder} >= 0`),
    uniqueIndex("uq_options_question_sort_order").on(table.questionId, table.sortOrder),
    uniqueIndex("uq_options_question_id_id").on(table.questionId, table.id),
    index("idx_options_question_enabled").on(table.questionId, table.isEnabled),
  ],
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    voterKeyHash: text("voter_key_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_votes_id_question_id").on(table.id, table.questionId),
    uniqueIndex("uq_votes_one_per_voter_per_question").on(table.questionId, table.voterKeyHash),
    index("idx_votes_question_created").on(table.questionId, table.createdAt),
  ],
);

export const voteChoices = sqliteTable(
  "vote_choices",
  {
    voteId: text("vote_id").notNull(),
    questionId: text("question_id").notNull(),
    optionId: text("option_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.voteId, table.optionId] }),
    foreignKey({
      columns: [table.voteId, table.questionId],
      foreignColumns: [votes.id, votes.questionId],
      name: "fk_vote_choices_vote",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.questionId, table.optionId],
      foreignColumns: [options.questionId, options.id],
      name: "fk_vote_choices_option",
    }).onDelete("cascade"),
    index("idx_vote_choices_question_option").on(table.questionId, table.optionId),
    index("idx_vote_choices_option").on(table.optionId),
  ],
);
