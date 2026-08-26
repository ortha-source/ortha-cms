ALTER TABLE "segments" ADD COLUMN "workspace_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
CREATE INDEX "segments_workspaces_idx" ON "segments" USING gin ("workspace_ids");