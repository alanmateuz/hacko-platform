CREATE TABLE `login_failures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT 0 NOT NULL;