CREATE TABLE "protection_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"required_approvals" integer DEFAULT 1 NOT NULL,
	"require_other_person" boolean DEFAULT true NOT NULL,
	"count_stale_approvals" boolean DEFAULT false NOT NULL,
	"admin_bypass" boolean DEFAULT true NOT NULL,
	"allow_token_publish" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protection_rules_workspace_type_unique" UNIQUE("workspace_id","kind","slug"),
	CONSTRAINT "protection_rules_kind_check" CHECK ("protection_rules"."kind" in ('collection', 'single')),
	CONSTRAINT "protection_rules_required_approvals_check" CHECK ("protection_rules"."required_approvals" >= 1)
);
--> statement-breakpoint
CREATE TABLE "review_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"entry_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_approvals_revision_user_unique" UNIQUE("revision_id","user_id"),
	CONSTRAINT "review_approvals_decision_check" CHECK ("review_approvals"."decision" in ('approved', 'changes_requested'))
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"entry_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "protection_rules_workspace_idx" ON "protection_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "review_approvals_workspace_entry_idx" ON "review_approvals" USING btree ("workspace_id","entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_requests_open_entry_unique" ON "review_requests" USING btree ("entry_id") WHERE "review_requests"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "review_requests_workspace_open_idx" ON "review_requests" USING btree ("workspace_id","resolved_at");