CREATE TABLE "copilot_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid,
	"provider" text,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"billable_tokens" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"stop_reason" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "copilot_usage_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copilot_usage_user_day_idx" ON "copilot_usage" USING btree ("user_id","workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "copilot_usage_workspace_day_idx" ON "copilot_usage" USING btree ("workspace_id","started_at");