CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`root_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `files_owner_entity` ON `files` (`owner_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `files_owner_root_version` ON `files` (`owner_id`,`root_id`,`version`);--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text NOT NULL,
	`owner_id` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operations_owner_request` ON `operations` (`owner_id`,`id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
