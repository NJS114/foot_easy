ALTER TABLE `files` ADD `folder_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `uploaded_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `submitted_by_member_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `recipient_member_ids` text DEFAULT '[]' NOT NULL;