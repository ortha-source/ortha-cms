DROP INDEX "content_author_workspace_status_idx";--> statement-breakpoint
-- Hand-edited backfill (mirrors 0006_content_i18n): pre-existing authors become
-- the default locale ('en'), each its own translation group (locale_group_id
-- keeps its schema default — gen_random_uuid() stamps every existing row a
-- distinct group). The transient DEFAULT on "locale" exists only to satisfy
-- NOT NULL on populated tables and is dropped immediately — the service layer
-- always stamps the locale.
ALTER TABLE "content_author" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_author" ALTER COLUMN "locale" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "content_author" ADD COLUMN "locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE INDEX "content_author_workspace_locale_idx" ON "content_author" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_author_group_locale_unique" ON "content_author" USING btree ("locale_group_id","locale") WHERE "content_author"."deleted_at" is null;