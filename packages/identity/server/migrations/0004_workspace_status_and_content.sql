CREATE TYPE "public"."content_kind" AS ENUM('collection', 'single');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "workspace_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "content_kind" NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_content_unique" UNIQUE("workspace_id","kind","slug")
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "status" "workspace_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_content" ADD CONSTRAINT "workspace_content_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_content_workspace_id_idx" ON "workspace_content" USING btree ("workspace_id");