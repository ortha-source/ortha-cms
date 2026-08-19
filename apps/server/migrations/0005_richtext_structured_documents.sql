-- Rich text becomes a structured document (ORT-84).
--
-- A `richtext` value is now the editor's node tree rather than an opaque HTML
-- string, so the column holds `jsonb`. `USING to_jsonb("col")` is the whole
-- migration: an existing HTML body becomes a JSON *string* in the same column,
-- which is still a valid rich-text value — it reads, validates and renders as
-- the legacy body it is, and is rewritten as a document the next time the
-- entry is saved from the editor. Nothing is parsed, so nothing can be lost.
-- Without the USING clause Postgres refuses the cast outright.
ALTER TABLE "content_article" ALTER COLUMN "body" SET DATA TYPE jsonb USING to_jsonb("body");--> statement-breakpoint
ALTER TABLE "content_author" ALTER COLUMN "bio" SET DATA TYPE jsonb USING to_jsonb("bio");--> statement-breakpoint
ALTER TABLE "content_master_collection" ALTER COLUMN "body" SET DATA TYPE jsonb USING to_jsonb("body");--> statement-breakpoint
ALTER TABLE "content_master_single" ALTER COLUMN "body" SET DATA TYPE jsonb USING to_jsonb("body");
