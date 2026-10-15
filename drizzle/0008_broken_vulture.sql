ALTER TABLE `events` ADD `submission_deadline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `submission_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `submission_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `submission_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `submitted_at` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `review_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `reviewed_at` text;