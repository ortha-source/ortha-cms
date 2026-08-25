CREATE TYPE "public"."access_fallback" AS ENUM('hidden', 'teaser', 'paywall');--> statement-breakpoint
CREATE TYPE "public"."access_target_kind" AS ENUM('workspace', 'type', 'entry');--> statement-breakpoint
CREATE TYPE "public"."segment_cardinality" AS ENUM('low', 'high');--> statement-breakpoint
CREATE TYPE "public"."segment_kind" AS ENUM('set', 'mask');--> statement-breakpoint
CREATE TYPE "public"."segment_type_managed_by" AS ENUM('config', 'ui');--> statement-breakpoint
CREATE TYPE "public"."segment_type_state" AS ENUM('active', 'draining', 'free');--> statement-breakpoint
CREATE TABLE "access_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_kind" "access_target_kind" NOT NULL,
	"target_slug" text,
	"target_entry_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"exclusions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"fallback" "access_fallback" DEFAULT 'teaser' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_access" (
	"entry_id" uuid NOT NULL,
	"group_no" integer NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type_slug" text NOT NULL,
	"allow_d1" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d1" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d2" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d2" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d3" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d3" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d4" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d4" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d5" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d5" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d6" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d6" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d7" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d7" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_d8" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny_d8" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"access_from" timestamp with time zone,
	"access_to" timestamp with time zone,
	"rule_id" uuid,
	"fallback" "access_fallback" DEFAULT 'teaser' NOT NULL,
	"projected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_access_entry_id_group_no_pk" PRIMARY KEY("entry_id","group_no")
);
--> statement-breakpoint
CREATE TABLE "segment_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_kind" "access_target_kind" NOT NULL,
	"target_slug" text,
	"target_entry_id" uuid,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"cardinality" "segment_cardinality" DEFAULT 'low' NOT NULL,
	"slot" integer NOT NULL,
	"state" "segment_type_state" DEFAULT 'active' NOT NULL,
	"managed_by" "segment_type_managed_by" DEFAULT 'ui' NOT NULL,
	"source" jsonb DEFAULT '{"kind":"manual"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segment_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" "segment_kind" DEFAULT 'set' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segments_type_key_unique" UNIQUE("type_id","key")
);
--> statement-breakpoint
ALTER TABLE "access_assignments" ADD CONSTRAINT "access_assignments_rule_id_access_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."access_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_grants" ADD CONSTRAINT "segment_grants_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_type_id_segment_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."segment_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_assignments_workspace_unique" ON "access_assignments" USING btree ("workspace_id") WHERE "access_assignments"."target_kind" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX "access_assignments_type_unique" ON "access_assignments" USING btree ("workspace_id","target_slug") WHERE "access_assignments"."target_kind" = 'type';--> statement-breakpoint
CREATE UNIQUE INDEX "access_assignments_entry_unique" ON "access_assignments" USING btree ("workspace_id","target_entry_id") WHERE "access_assignments"."target_kind" = 'entry';--> statement-breakpoint
CREATE INDEX "access_assignments_rule_idx" ON "access_assignments" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_rules_workspace_key_unique" ON "access_rules" USING btree ("workspace_id","key") WHERE "access_rules"."workspace_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "access_rules_global_key_unique" ON "access_rules" USING btree ("key") WHERE "access_rules"."workspace_id" IS NULL;--> statement-breakpoint
CREATE INDEX "access_rules_workspace_idx" ON "access_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "entry_access_workspace_type_idx" ON "entry_access" USING btree ("workspace_id","type_slug");--> statement-breakpoint
CREATE INDEX "entry_access_rule_idx" ON "entry_access" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d1_idx" ON "entry_access" USING gin ("allow_d1");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d1_idx" ON "entry_access" USING gin ("deny_d1");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d2_idx" ON "entry_access" USING gin ("allow_d2");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d2_idx" ON "entry_access" USING gin ("deny_d2");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d3_idx" ON "entry_access" USING gin ("allow_d3");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d3_idx" ON "entry_access" USING gin ("deny_d3");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d4_idx" ON "entry_access" USING gin ("allow_d4");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d4_idx" ON "entry_access" USING gin ("deny_d4");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d5_idx" ON "entry_access" USING gin ("allow_d5");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d5_idx" ON "entry_access" USING gin ("deny_d5");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d6_idx" ON "entry_access" USING gin ("allow_d6");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d6_idx" ON "entry_access" USING gin ("deny_d6");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d7_idx" ON "entry_access" USING gin ("allow_d7");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d7_idx" ON "entry_access" USING gin ("deny_d7");--> statement-breakpoint
CREATE INDEX "entry_access_allow_d8_idx" ON "entry_access" USING gin ("allow_d8");--> statement-breakpoint
CREATE INDEX "entry_access_deny_d8_idx" ON "entry_access" USING gin ("deny_d8");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_grants_workspace_unique" ON "segment_grants" USING btree ("segment_id","workspace_id") WHERE "segment_grants"."target_kind" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX "segment_grants_type_unique" ON "segment_grants" USING btree ("segment_id","workspace_id","target_slug") WHERE "segment_grants"."target_kind" = 'type';--> statement-breakpoint
CREATE UNIQUE INDEX "segment_grants_entry_unique" ON "segment_grants" USING btree ("segment_id","workspace_id","target_entry_id") WHERE "segment_grants"."target_kind" = 'entry';--> statement-breakpoint
CREATE INDEX "segment_grants_segment_idx" ON "segment_grants" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "segment_grants_workspace_idx" ON "segment_grants" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_types_slot_unique" ON "segment_types" USING btree ("slot") WHERE "segment_types"."state" <> 'free';--> statement-breakpoint
CREATE INDEX "segments_type_id_idx" ON "segments" USING btree ("type_id");