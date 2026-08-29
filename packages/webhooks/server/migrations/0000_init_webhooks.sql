CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"event_kind" text NOT NULL,
	"workspace_id" uuid,
	"content_type" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"last_status_code" integer,
	"last_error" text,
	"response_snippet" text,
	"duration_ms" integer,
	"redelivery_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoint_workspaces" (
	"endpoint_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "webhook_endpoint_workspaces_endpoint_id_workspace_id_pk" PRIMARY KEY("endpoint_id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"secret_hint" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"event_kinds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"all_workspaces" boolean DEFAULT false NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"disabled_reason" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoint_workspaces" ADD CONSTRAINT "webhook_endpoint_workspaces_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_endpoint_event_unique" ON "webhook_deliveries" USING btree ("endpoint_id","event_id") WHERE "webhook_deliveries"."redelivery_of" is null;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_claimable_idx" ON "webhook_deliveries" USING btree ("next_attempt_at") WHERE "webhook_deliveries"."status" in ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_idx" ON "webhook_deliveries" USING btree ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_completed_idx" ON "webhook_deliveries" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoint_workspaces_workspace_idx" ON "webhook_endpoint_workspaces" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_enabled_idx" ON "webhook_endpoints" USING btree ("enabled");