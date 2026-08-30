ALTER TABLE "activity_events" ADD COLUMN "actor_type" text;--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
CREATE INDEX "activity_events_workspace_idx" ON "activity_events" USING btree ("workspace_id","at");--> statement-breakpoint
-- Backfill: every actor recorded before this column existed is a person. Nothing
-- else could be one — a token-authenticated write passed no actor at all — so
-- this is a statement of fact rather than a guess, and it keeps a reader from
-- having to treat a null `actor_type` on an actored row as "unknown kind".
UPDATE "activity_events" SET "actor_type" = 'user' WHERE "actor_id" IS NOT NULL AND "actor_type" IS NULL;
