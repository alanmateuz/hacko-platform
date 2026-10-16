CREATE TABLE `placements` (
	`event_id` text NOT NULL,
	`place` integer NOT NULL,
	`team_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`event_id`, `place`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "placements_place" CHECK("placements"."place" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `placements_team` ON `placements` (`event_id`,`team_id`);