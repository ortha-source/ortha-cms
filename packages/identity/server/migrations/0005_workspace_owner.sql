ALTER TABLE "workspaces" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
-- Backfill existing workspaces: adopt the earliest membership as the owner. For
-- rows created before ownership was recorded, membership `created_at` can tie
-- (owner + initial members were inserted together), so this is a best-effort,
-- one-time guess frozen here rather than re-derived per request. New workspaces
-- set `owner_user_id` explicitly at creation.
UPDATE "workspaces" w
SET "owner_user_id" = m."user_id"
FROM (
    SELECT DISTINCT ON ("workspace_id") "workspace_id", "user_id"
    FROM "memberships"
    ORDER BY "workspace_id", "created_at", "id"
) m
WHERE m."workspace_id" = w."id";--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;