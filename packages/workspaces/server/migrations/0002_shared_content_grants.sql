ALTER TABLE "workspace_content" DROP CONSTRAINT "workspace_content_unique";--> statement-breakpoint
ALTER TABLE "workspace_content" ADD COLUMN "source_workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_content" ADD CONSTRAINT "workspace_content_source_workspace_id_workspaces_id_fk" FOREIGN KEY ("source_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_content_source_workspace_id_idx" ON "workspace_content" USING btree ("source_workspace_id");--> statement-breakpoint
ALTER TABLE "workspace_content" ADD CONSTRAINT "workspace_content_unique" UNIQUE NULLS NOT DISTINCT("workspace_id","kind","slug","source_workspace_id");--> statement-breakpoint
-- Data migration (hand-appended; ADR-0019 "Explicit per-source grants").
-- Before this migration one own grant (W, kind, slug) implicitly exposed that
-- type from every shared, active workspace. Preserve exactly what each
-- workspace could see: for every own grant of W and every shared, non-archived
-- S <> W that holds its own grant for the same (kind, slug), write the explicit
-- shared grant (W, kind, slug, S).
INSERT INTO "workspace_content" ("workspace_id", "kind", "slug", "source_workspace_id")
SELECT "consumer"."workspace_id", "consumer"."kind", "consumer"."slug", "source"."id"
FROM "workspace_content" AS "consumer"
JOIN "workspaces" AS "source"
    ON "source"."is_shared" = true
    AND "source"."status" = 'active'
    AND "source"."id" <> "consumer"."workspace_id"
JOIN "workspace_content" AS "source_grant"
    ON "source_grant"."workspace_id" = "source"."id"
    AND "source_grant"."kind" = "consumer"."kind"
    AND "source_grant"."slug" = "consumer"."slug"
    AND "source_grant"."source_workspace_id" IS NULL
WHERE "consumer"."source_workspace_id" IS NULL
ON CONFLICT DO NOTHING;
