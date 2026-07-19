CREATE TABLE "content_article_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_article_tags_pair_unique" UNIQUE("source_id","target_id")
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
	"text" text,
	"richtext" text,
	"number" integer,
	"money" integer,
	"boolean" boolean,
	"date" date,
	"datetime" timestamp with time zone,
	"select" text,
	"multiselect" jsonb,
	"json" jsonb,
	"author_id" uuid,
	"seo_id" uuid,
	CONSTRAINT "content_article_seo_id_unique" UNIQUE("seo_id")
);
--> statement-breakpoint
CREATE TABLE "content_author" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"bio" text
);
--> statement-breakpoint
CREATE TABLE "content_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"article_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_landing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"richtext" text,
	"number" integer,
	"money" integer,
	"boolean" boolean DEFAULT false NOT NULL,
	"date" date,
	"datetime" timestamp with time zone,
	"select" text,
	"multiselect" jsonb,
	"json" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_seo_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"canonical_url" text
);
--> statement-breakpoint
CREATE TABLE "content_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"name" text,
	"slug" text
);
--> statement-breakpoint
ALTER TABLE "content_article_tags" ADD CONSTRAINT "content_article_tags_source_id_content_article_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article_tags" ADD CONSTRAINT "content_article_tags_target_id_content_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_author_id_content_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."content_author"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_seo_id_content_seo_meta_id_fk" FOREIGN KEY ("seo_id") REFERENCES "public"."content_seo_meta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_comment" ADD CONSTRAINT "content_comment_article_id_content_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_article_tags_target_idx" ON "content_article_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_article_tags_source_pos_idx" ON "content_article_tags" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_article_workspace_locale_idx" ON "content_article" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_article_group_locale_unique" ON "content_article" USING btree ("locale_group_id","locale") WHERE "content_article"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_author_workspace_locale_idx" ON "content_author" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_author_group_locale_unique" ON "content_author" USING btree ("locale_group_id","locale") WHERE "content_author"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_comment_workspace_idx" ON "content_comment" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_landing_workspace_locale_idx" ON "content_landing" USING btree ("workspace_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "content_landing_group_locale_unique" ON "content_landing" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE INDEX "content_seo_meta_workspace_idx" ON "content_seo_meta" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_tag_workspace_status_idx" ON "content_tag" USING btree ("workspace_id","status");