DROP INDEX "content_article_workspace_status_idx";--> statement-breakpoint
DROP INDEX "content_landing_workspace_idx";--> statement-breakpoint
-- Hand-edited backfill: pre-existing rows become the default locale ('en'),
-- each its own translation group (locale_group_id keeps its schema default —
-- gen_random_uuid() stamps every existing row a distinct group). The transient
-- DEFAULT on "locale" exists only to satisfy NOT NULL on populated tables and
-- is dropped immediately — the service layer always stamps the locale.
ALTER TABLE "content_article" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_article" ALTER COLUMN "locale" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "content_article" ADD COLUMN "locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "content_landing" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_landing" ALTER COLUMN "locale" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "content_landing" ADD COLUMN "locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE INDEX "content_article_workspace_locale_idx" ON "content_article" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_article_group_locale_unique" ON "content_article" USING btree ("locale_group_id","locale") WHERE "content_article"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_landing_workspace_locale_idx" ON "content_landing" USING btree ("workspace_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "content_landing_group_locale_unique" ON "content_landing" USING btree ("locale_group_id","locale");