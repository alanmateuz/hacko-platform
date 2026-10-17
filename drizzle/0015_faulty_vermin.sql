CREATE TABLE `event_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'organizer' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_partners_role" CHECK("event_partners"."role" IN ('organizer','sponsor','supporter'))
);
--> statement-breakpoint
ALTER TABLE `events` ADD `stages` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `rules_url` text DEFAULT '' NOT NULL;