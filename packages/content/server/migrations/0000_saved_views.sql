CREATE TYPE "public"."view_visibility" AS ENUM('private', 'workspace');--> statement-breakpoint
CREATE TABLE "saved_view_defaults" (
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"view_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_view_defaults_user_id_scope_pk" PRIMARY KEY("user_id","scope")
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"visibility" "view_visibility" DEFAULT 'private' NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_owner_name_unique" UNIQUE("workspace_id","scope","owner_id","name")
);
--> statement-breakpoint
ALTER TABLE "saved_view_defaults" ADD CONSTRAINT "saved_view_defaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_defaults" ADD CONSTRAINT "saved_view_defaults_view_id_saved_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_view_defaults_view_id_idx" ON "saved_view_defaults" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "saved_views_workspace_scope_idx" ON "saved_views" USING btree ("workspace_id","scope");