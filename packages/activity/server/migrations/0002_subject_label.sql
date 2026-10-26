ALTER TABLE "activity_events" ADD COLUMN "subject_label" text;--> statement-breakpoint
-- Backfill from the frozen `meta` the row already carries, in the same order the
-- mapper's `subjectLabelOf` reads it (title, name, label, email, key, slug — a
-- string value only, so `{ name: { from, to } }` is skipped), so a row written
-- before this column existed is as searchable as one written after. It derives
-- a value from the row's own payload and changes nothing a reader could see:
-- the same precedent as `0001`'s `actor_type` backfill.
UPDATE "activity_events" SET "subject_label" = LEFT(COALESCE(
    CASE WHEN jsonb_typeof("meta"->'title') = 'string' THEN NULLIF(btrim("meta"->>'title'), '') END,
    CASE WHEN jsonb_typeof("meta"->'name') = 'string' THEN NULLIF(btrim("meta"->>'name'), '') END,
    CASE WHEN jsonb_typeof("meta"->'label') = 'string' THEN NULLIF(btrim("meta"->>'label'), '') END,
    CASE WHEN jsonb_typeof("meta"->'email') = 'string' THEN NULLIF(btrim("meta"->>'email'), '') END,
    CASE WHEN jsonb_typeof("meta"->'key') = 'string' THEN NULLIF(btrim("meta"->>'key'), '') END,
    CASE WHEN jsonb_typeof("meta"->'slug') = 'string' THEN NULLIF(btrim("meta"->>'slug'), '') END
), 255) WHERE "subject_label" IS NULL AND jsonb_typeof("meta") = 'object';
