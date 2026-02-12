CREATE TABLE `screenshots_table` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`language` text NOT NULL,
	`device` text NOT NULL,
	`job_status` text NOT NULL,
	`r2_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `screenshots_table_r2_key_unique` ON `screenshots_table` (`r2_key`);--> statement-breakpoint
CREATE TABLE `urls_table` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`language` text NOT NULL
);
