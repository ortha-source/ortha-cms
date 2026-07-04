DROP INDEX "content_tag_workspace_idx";--> statement-breakpoint
ALTER TABLE "content_tag" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content_tag" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_tag" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_tag" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "content_tag_workspace_status_idx" ON "content_tag" USING btree ("workspace_id","status");