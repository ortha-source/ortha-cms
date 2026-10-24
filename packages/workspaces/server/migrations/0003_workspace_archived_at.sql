ALTER TABLE "workspaces" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
-- Data migration (hand-appended). A workspace archived before this column
-- existed has no stamp; its last write is the closest honest answer, and
-- `updated_at` is refreshed by the same update that flipped the status.
UPDATE "workspaces" SET "archived_at" = "updated_at" WHERE "status" = 'archived';
