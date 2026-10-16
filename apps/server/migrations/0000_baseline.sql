CREATE TABLE "content_entry_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"entry_id" uuid NOT NULL,
	"locale_group_id" uuid,
	"locale" text,
	"revision_number" integer NOT NULL,
	"status" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "content_entry_revisions_entry_number_uq" UNIQUE("entry_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "content_field_boolean" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"flag" boolean,
	"required_flag" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_field_date" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"date" date,
	"datetime" timestamp with time zone,
	"required_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_field_defaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text,
	"number" double precision,
	"money" integer,
	"boolean" boolean,
	"date" date,
	"select" text,
	"multiselect" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_field_json" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"json" jsonb,
	"required_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_field_layout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"starts_on" date,
	"ends_on" date,
	"notes" text,
	"internal_id" text
);
--> statement-breakpoint
CREATE TABLE "content_field_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"image" uuid,
	"gallery" jsonb,
	"any_file" uuid,
	"attachments" jsonb,
	"pdf_only" uuid,
	"video" uuid,
	"audio" uuid
);
--> statement-breakpoint
CREATE TABLE "content_field_number" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decimal" double precision,
	"integer" integer,
	"bounded" double precision,
	"rating" integer NOT NULL,
	"money" integer,
	"bounded_money" integer
);
--> statement-breakpoint
CREATE TABLE "content_field_richtext" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plain" jsonb,
	"required" jsonb NOT NULL,
	"bounded" jsonb,
	"unstructured" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_field_select" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"select" text,
	"required_select" text NOT NULL,
	"multiselect" jsonb,
	"required_multiselect" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_field_text" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plain" text,
	"required" text NOT NULL,
	"bounded" text,
	"slug" text,
	"textarea" text,
	"email" text,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "content_flags_all" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"body" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_flags_none" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_flags_paranoid" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_flags_publishable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"title" text,
	"body" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_i18n_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"slug" text,
	"summary" text,
	"body" jsonb,
	"code" text,
	"price" integer,
	"audience" text,
	"cover" uuid,
	"logo" uuid
);
--> statement-breakpoint
CREATE TABLE "content_i18n_relations_mirrored_many" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_i18n_relations_mirrored_many_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_i18n_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"shared_link_id" uuid,
	"mirrored_link_id" uuid,
	"independent_link_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_i18n_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "content_rel_many_to_many_many" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_rel_many_to_many_many_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_rel_many_to_many" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_rel_many_to_one" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"required_restrict_id" uuid NOT NULL,
	"optional_set_null_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_rel_one_to_one" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"unique_id" uuid,
	CONSTRAINT "content_rel_one_to_one_unique_id_unique" UNIQUE("unique_id")
);
--> statement-breakpoint
CREATE TABLE "content_rel_self_related" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_rel_self_related_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_rel_self" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_rel_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "content_scenario_review_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"title" text,
	"body" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_scenario_review_one" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"title" text,
	"body" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_scenario_review_two" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"title" text,
	"body" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_scenario_sibling_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"sku" text,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_single_i18n" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"headline" text,
	"body" jsonb,
	"theme" text
);
--> statement-breakpoint
CREATE TABLE "content_single_plain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"headline" text NOT NULL,
	"body" jsonb,
	"contact_email" text
);
--> statement-breakpoint
ALTER TABLE "content_i18n_relations_mirrored_many" ADD CONSTRAINT "content_i18n_relations_mirrored_many_source_id_content_i18n_relations_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_i18n_relations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_i18n_relations_mirrored_many" ADD CONSTRAINT "content_i18n_relations_mirrored_many_target_id_content_i18n_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_i18n_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_i18n_relations" ADD CONSTRAINT "content_i18n_relations_shared_link_id_content_rel_target_id_fk" FOREIGN KEY ("shared_link_id") REFERENCES "public"."content_rel_target"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_i18n_relations" ADD CONSTRAINT "content_i18n_relations_mirrored_link_id_content_i18n_target_id_fk" FOREIGN KEY ("mirrored_link_id") REFERENCES "public"."content_i18n_target"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_i18n_relations" ADD CONSTRAINT "content_i18n_relations_independent_link_id_content_rel_target_id_fk" FOREIGN KEY ("independent_link_id") REFERENCES "public"."content_rel_target"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_many_to_many_many" ADD CONSTRAINT "content_rel_many_to_many_many_source_id_content_rel_many_to_many_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_rel_many_to_many"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_many_to_many_many" ADD CONSTRAINT "content_rel_many_to_many_many_target_id_content_rel_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_rel_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_many_to_one" ADD CONSTRAINT "content_rel_many_to_one_required_restrict_id_content_rel_target_id_fk" FOREIGN KEY ("required_restrict_id") REFERENCES "public"."content_rel_target"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_many_to_one" ADD CONSTRAINT "content_rel_many_to_one_optional_set_null_id_content_rel_target_id_fk" FOREIGN KEY ("optional_set_null_id") REFERENCES "public"."content_rel_target"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_one_to_one" ADD CONSTRAINT "content_rel_one_to_one_unique_id_content_rel_target_id_fk" FOREIGN KEY ("unique_id") REFERENCES "public"."content_rel_target"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_self_related" ADD CONSTRAINT "content_rel_self_related_source_id_content_rel_self_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_rel_self"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_self_related" ADD CONSTRAINT "content_rel_self_related_target_id_content_rel_self_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_rel_self"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_rel_self" ADD CONSTRAINT "content_rel_self_parent_id_content_rel_self_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_rel_self"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_scenario_sibling_sync" ADD CONSTRAINT "content_scenario_sibling_sync_owner_id_content_rel_target_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."content_rel_target"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_entry_revisions_entry_idx" ON "content_entry_revisions" USING btree ("entry_id","revision_number");--> statement-breakpoint
CREATE INDEX "content_entry_revisions_workspace_idx" ON "content_entry_revisions" USING btree ("workspace_id","content_type");--> statement-breakpoint
CREATE INDEX "content_field_boolean_workspace_idx" ON "content_field_boolean" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_date_workspace_idx" ON "content_field_date" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_defaults_workspace_idx" ON "content_field_defaults" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_json_workspace_idx" ON "content_field_json" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_layout_workspace_idx" ON "content_field_layout" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_media_workspace_idx" ON "content_field_media" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_number_workspace_idx" ON "content_field_number" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_richtext_workspace_idx" ON "content_field_richtext" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_select_workspace_idx" ON "content_field_select" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_field_text_workspace_idx" ON "content_field_text" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_flags_all_workspace_locale_idx" ON "content_flags_all" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_flags_all_group_locale_unique" ON "content_flags_all" USING btree ("locale_group_id","locale") WHERE "content_flags_all"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_flags_none_workspace_idx" ON "content_flags_none" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_flags_paranoid_workspace_idx" ON "content_flags_paranoid" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_flags_publishable_workspace_status_idx" ON "content_flags_publishable" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_i18n_fields_workspace_locale_idx" ON "content_i18n_fields" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_i18n_fields_group_locale_unique" ON "content_i18n_fields" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE INDEX "content_i18n_relations_mirrored_many_target_idx" ON "content_i18n_relations_mirrored_many" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_i18n_relations_mirrored_many_source_pos_idx" ON "content_i18n_relations_mirrored_many" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_i18n_relations_workspace_locale_idx" ON "content_i18n_relations" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE INDEX "content_i18n_relations_shared_link_id_idx" ON "content_i18n_relations" USING btree ("shared_link_id");--> statement-breakpoint
CREATE INDEX "content_i18n_relations_mirrored_link_id_idx" ON "content_i18n_relations" USING btree ("mirrored_link_id");--> statement-breakpoint
CREATE INDEX "content_i18n_relations_independent_link_id_idx" ON "content_i18n_relations" USING btree ("independent_link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_i18n_relations_group_locale_unique" ON "content_i18n_relations" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE INDEX "content_i18n_target_workspace_locale_idx" ON "content_i18n_target" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_i18n_target_group_locale_unique" ON "content_i18n_target" USING btree ("locale_group_id","locale") WHERE "content_i18n_target"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_rel_many_to_many_many_target_idx" ON "content_rel_many_to_many_many" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_rel_many_to_many_many_source_pos_idx" ON "content_rel_many_to_many_many" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_rel_many_to_many_workspace_idx" ON "content_rel_many_to_many" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_rel_many_to_one_workspace_idx" ON "content_rel_many_to_one" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_rel_many_to_one_required_restrict_id_idx" ON "content_rel_many_to_one" USING btree ("required_restrict_id");--> statement-breakpoint
CREATE INDEX "content_rel_many_to_one_optional_set_null_id_idx" ON "content_rel_many_to_one" USING btree ("optional_set_null_id");--> statement-breakpoint
CREATE INDEX "content_rel_one_to_one_workspace_idx" ON "content_rel_one_to_one" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_rel_self_related_target_idx" ON "content_rel_self_related" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_rel_self_related_source_pos_idx" ON "content_rel_self_related" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_rel_self_workspace_idx" ON "content_rel_self" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_rel_self_parent_id_idx" ON "content_rel_self" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "content_rel_target_workspace_status_idx" ON "content_rel_target" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_scenario_review_off_workspace_status_idx" ON "content_scenario_review_off" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_scenario_review_one_workspace_status_idx" ON "content_scenario_review_one" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_scenario_review_two_workspace_status_idx" ON "content_scenario_review_two" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_scenario_sibling_sync_workspace_locale_idx" ON "content_scenario_sibling_sync" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE INDEX "content_scenario_sibling_sync_owner_id_idx" ON "content_scenario_sibling_sync" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_scenario_sibling_sync_group_locale_unique" ON "content_scenario_sibling_sync" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE INDEX "content_single_i18n_workspace_locale_idx" ON "content_single_i18n" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_single_i18n_group_locale_unique" ON "content_single_i18n" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE INDEX "content_single_plain_workspace_idx" ON "content_single_plain" USING btree ("workspace_id");