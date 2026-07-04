DROP INDEX "content_author_workspace_idx";--> statement-breakpoint
ALTER TABLE "content_author" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content_author" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_author" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_author" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "content_author_workspace_status_idx" ON "content_author" USING btree ("workspace_id","status");