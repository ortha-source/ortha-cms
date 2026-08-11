CREATE TYPE "public"."copilot_skill_mode" AS ENUM('manual', 'always');--> statement-breakpoint
CREATE TABLE "copilot_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"mode" "copilot_skill_mode" DEFAULT 'manual' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD COLUMN "skills" jsonb;--> statement-breakpoint
ALTER TABLE "copilot_skills" ADD CONSTRAINT "copilot_skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_skills" ADD CONSTRAINT "copilot_skills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "copilot_skills_workspace_name_idx" ON "copilot_skills" USING btree ("workspace_id","name");