CREATE TABLE "content_article_related" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_article_related_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_article" (
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
	"slug" text,
	"excerpt" text,
	"body" text,
	"reading_minutes" integer,
	"rating" double precision,
	"price" integer,
	"featured" boolean,
	"editorial_date" date,
	"embargo_until" timestamp with time zone,
	"layout" text,
	"audiences" jsonb,
	"metadata" jsonb,
	"author_id" uuid,
	"seo_id" uuid,
	"category_id" uuid,
	CONSTRAINT "content_article_seo_id_unique" UNIQUE("seo_id")
);
--> statement-breakpoint
CREATE TABLE "content_article_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_article_tags_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_author" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"handle" text NOT NULL,
	"bio" text,
	"accent_color" text,
	"website" text
);
--> statement-breakpoint
CREATE TABLE "content_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"rating" double precision,
	"approved" boolean DEFAULT false NOT NULL,
	"article_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_home_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"hero_title" text,
	"hero_subtitle" text,
	"cta_label" text,
	"cta_href" text,
	"showcase_theme" text,
	"featured_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_master_collection_related" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_master_collection_related_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_master_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"plain_text" text,
	"email" text,
	"slug" text,
	"brand_color" text,
	"summary" text,
	"body" text,
	"score" double precision,
	"view_count" integer,
	"price" integer,
	"featured" boolean DEFAULT false,
	"event_date" date,
	"starts_at" timestamp with time zone,
	"status_choice" text,
	"topics" jsonb,
	"metadata" jsonb,
	"owner_id" uuid,
	"seo_id" uuid,
	"parent_id" uuid,
	CONSTRAINT "content_master_collection_seo_id_unique" UNIQUE("seo_id")
);
--> statement-breakpoint
CREATE TABLE "content_master_collection_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_master_collection_tags_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_master_single" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"headline" text,
	"slug" text,
	"accent_color" text,
	"intro" text,
	"contact_email" text,
	"body" text,
	"weight" double precision,
	"hit_count" integer,
	"price" integer,
	"published_flag" boolean DEFAULT false,
	"go_live_date" date,
	"go_live_at" timestamp with time zone,
	"variant" text,
	"flags" jsonb,
	"config" jsonb,
	"curator_id" uuid,
	"seo_id" uuid,
	CONSTRAINT "content_master_single_seo_id_unique" UNIQUE("seo_id")
);
--> statement-breakpoint
CREATE TABLE "content_master_single_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_master_single_tags_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_seo_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta_title" text NOT NULL,
	"meta_description" text,
	"canonical_url" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"open_graph" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"site_name" text NOT NULL,
	"tagline" text,
	"brand_color" text,
	"default_currency" text,
	"enabled_features" jsonb,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"social_links" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_article_related" ADD CONSTRAINT "content_article_related_source_id_content_article_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article_related" ADD CONSTRAINT "content_article_related_target_id_content_article_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_author_id_content_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."content_author"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_seo_id_content_seo_meta_id_fk" FOREIGN KEY ("seo_id") REFERENCES "public"."content_seo_meta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_category_id_content_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article_tags" ADD CONSTRAINT "content_article_tags_source_id_content_article_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article_tags" ADD CONSTRAINT "content_article_tags_target_id_content_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_category" ADD CONSTRAINT "content_category_parent_id_content_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_comment" ADD CONSTRAINT "content_comment_article_id_content_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_home_page" ADD CONSTRAINT "content_home_page_featured_id_content_article_id_fk" FOREIGN KEY ("featured_id") REFERENCES "public"."content_article"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection_related" ADD CONSTRAINT "content_master_collection_related_source_id_content_master_collection_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_master_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection_related" ADD CONSTRAINT "content_master_collection_related_target_id_content_master_collection_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_master_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection" ADD CONSTRAINT "content_master_collection_owner_id_content_author_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."content_author"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection" ADD CONSTRAINT "content_master_collection_seo_id_content_seo_meta_id_fk" FOREIGN KEY ("seo_id") REFERENCES "public"."content_seo_meta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection" ADD CONSTRAINT "content_master_collection_parent_id_content_master_collection_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_master_collection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection_tags" ADD CONSTRAINT "content_master_collection_tags_source_id_content_master_collection_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_master_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_collection_tags" ADD CONSTRAINT "content_master_collection_tags_target_id_content_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_single" ADD CONSTRAINT "content_master_single_curator_id_content_author_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."content_author"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_single" ADD CONSTRAINT "content_master_single_seo_id_content_seo_meta_id_fk" FOREIGN KEY ("seo_id") REFERENCES "public"."content_seo_meta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_single_tags" ADD CONSTRAINT "content_master_single_tags_source_id_content_master_single_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_master_single"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_master_single_tags" ADD CONSTRAINT "content_master_single_tags_target_id_content_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_article_related_target_idx" ON "content_article_related" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_article_related_source_pos_idx" ON "content_article_related" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_article_workspace_locale_idx" ON "content_article" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_article_group_locale_unique" ON "content_article" USING btree ("locale_group_id","locale") WHERE "content_article"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_article_tags_target_idx" ON "content_article_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_article_tags_source_pos_idx" ON "content_article_tags" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_author_workspace_idx" ON "content_author" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_category_workspace_idx" ON "content_category" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_comment_workspace_idx" ON "content_comment" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_home_page_workspace_locale_idx" ON "content_home_page" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_home_page_group_locale_unique" ON "content_home_page" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE INDEX "content_master_collection_related_target_idx" ON "content_master_collection_related" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_master_collection_related_source_pos_idx" ON "content_master_collection_related" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_master_collection_workspace_locale_idx" ON "content_master_collection" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_master_collection_group_locale_unique" ON "content_master_collection" USING btree ("locale_group_id","locale") WHERE "content_master_collection"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_master_collection_tags_target_idx" ON "content_master_collection_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_master_collection_tags_source_pos_idx" ON "content_master_collection_tags" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_master_single_workspace_locale_idx" ON "content_master_single" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_master_single_group_locale_unique" ON "content_master_single" USING btree ("locale_group_id","locale") WHERE "content_master_single"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_master_single_tags_target_idx" ON "content_master_single_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_master_single_tags_source_pos_idx" ON "content_master_single_tags" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_seo_meta_workspace_idx" ON "content_seo_meta" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_site_settings_workspace_idx" ON "content_site_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_tag_workspace_locale_idx" ON "content_tag" USING btree ("workspace_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "content_tag_group_locale_unique" ON "content_tag" USING btree ("locale_group_id","locale");