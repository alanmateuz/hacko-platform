CREATE TABLE `operation_checks` (
	`name` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "atomic_guard" CHECK("operation_checks"."valid" = 1)
);
