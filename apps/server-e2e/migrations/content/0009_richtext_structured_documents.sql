-- Rich text becomes a structured document (ORT-84) — the harness's mirror of
-- the host's `0005_richtext_structured_documents`.
--
-- `USING to_jsonb("col")` is the whole migration: an existing HTML body becomes
-- a JSON *string* in the same column, which is still a valid rich-text value.
-- Without the USING clause Postgres refuses the text → jsonb cast outright.
ALTER TABLE "content_test_article" ALTER COLUMN "richtext" SET DATA TYPE jsonb USING to_jsonb("richtext");--> statement-breakpoint
ALTER TABLE "content_test_author" ALTER COLUMN "bio" SET DATA TYPE jsonb USING to_jsonb("bio");--> statement-breakpoint
ALTER TABLE "content_test_comment" ALTER COLUMN "body" SET DATA TYPE jsonb USING to_jsonb("body");--> statement-breakpoint
ALTER TABLE "content_test_landing" ALTER COLUMN "richtext" SET DATA TYPE jsonb USING to_jsonb("richtext");
