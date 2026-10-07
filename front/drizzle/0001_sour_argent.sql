CREATE TABLE `workspace_chunks` (
	`owner_id` text NOT NULL,
	`part` integer NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_chunks_owner_part` ON `workspace_chunks` (`owner_id`,`part`);