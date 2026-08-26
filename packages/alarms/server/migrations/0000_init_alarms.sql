CREATE TABLE "alarm_findings" (
	"rule_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"state" text NOT NULL,
	"detail" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"muted_at" timestamp with time zone,
	"muted_by" uuid,
	"muted_reason" text,
	CONSTRAINT "alarm_findings_rule_id_entry_id_pk" PRIMARY KEY("rule_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "alarm_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"name" text NOT NULL,
	"finding_title" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"filter" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"broken_reason" text,
	"last_scan_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alarm_findings" ADD CONSTRAINT "alarm_findings_rule_id_alarm_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alarm_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alarm_findings_workspace_state_idx" ON "alarm_findings" USING btree ("workspace_id","state","rule_id");--> statement-breakpoint
CREATE INDEX "alarm_findings_entry_idx" ON "alarm_findings" USING btree ("entry_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "alarm_rules_workspace_name_idx" ON "alarm_rules" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "alarm_rules_workspace_type_idx" ON "alarm_rules" USING btree ("workspace_id","content_type","enabled");