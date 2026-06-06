CREATE TABLE `host_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "host_sessions_expiry_check" CHECK("host_sessions"."expires_at" > "host_sessions"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_host_sessions_token_hash` ON `host_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_host_sessions_room_created` ON `host_sessions` (`room_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_host_sessions_expires_at` ON `host_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "options_sort_order_check" CHECK("options"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_options_question_sort_order` ON `options` (`question_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_options_question_id_id` ON `options` (`question_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_options_question_enabled` ON `options` (`question_id`,`is_enabled`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`title` text NOT NULL,
	`question_type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`min_choices` integer DEFAULT 1 NOT NULL,
	`max_choices` integer DEFAULT 1 NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`opened_at` text,
	`closed_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "questions_type_check" CHECK("questions"."question_type" IN ('single', 'multiple')),
	CONSTRAINT "questions_status_check" CHECK("questions"."status" IN ('draft', 'active', 'closed')),
	CONSTRAINT "questions_min_choices_check" CHECK("questions"."min_choices" >= 1),
	CONSTRAINT "questions_max_choices_check" CHECK("questions"."max_choices" >= "questions"."min_choices"),
	CONSTRAINT "questions_single_choices_check" CHECK("questions"."question_type" != 'single'
          OR ("questions"."min_choices" = 1 AND "questions"."max_choices" = 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_questions_one_active_per_room` ON `questions` (`room_id`) WHERE "questions"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_questions_room_sort_order` ON `questions` (`room_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_questions_room_status` ON `questions` (`room_id`,`status`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_password_hash` text NOT NULL,
	`state_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	CONSTRAINT "rooms_status_check" CHECK("rooms"."status" IN ('open', 'closed')),
	CONSTRAINT "rooms_state_version_check" CHECK("rooms"."state_version" >= 1),
	CONSTRAINT "rooms_closed_at_check" CHECK(("rooms"."status" = 'open' AND "rooms"."closed_at" IS NULL)
          OR ("rooms"."status" = 'closed' AND "rooms"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_status` ON `rooms` (`status`);--> statement-breakpoint
CREATE INDEX `idx_rooms_created_at` ON `rooms` (`created_at`);--> statement-breakpoint
CREATE TABLE `vote_choices` (
	`vote_id` text NOT NULL,
	`question_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`vote_id`, `option_id`),
	FOREIGN KEY (`vote_id`,`question_id`) REFERENCES `votes`(`id`,`question_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`,`option_id`) REFERENCES `options`(`question_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vote_choices_question_option` ON `vote_choices` (`question_id`,`option_id`);--> statement-breakpoint
CREATE INDEX `idx_vote_choices_option` ON `vote_choices` (`option_id`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`voter_key_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_votes_id_question_id` ON `votes` (`id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_votes_one_per_voter_per_question` ON `votes` (`question_id`,`voter_key_hash`);--> statement-breakpoint
CREATE INDEX `idx_votes_question_created` ON `votes` (`question_id`,`created_at`);