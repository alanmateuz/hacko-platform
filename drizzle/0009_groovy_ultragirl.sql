CREATE TABLE `delivery_items` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime` text DEFAULT '' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
