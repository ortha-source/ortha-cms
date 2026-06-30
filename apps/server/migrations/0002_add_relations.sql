CREATE TABLE "content_article_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "content_article_tags_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_author" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
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
	"name" text NOT NULL,
	"slug" text
);
--> statement-breakpoint
ALTER TABLE "content_article" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "content_article" ADD COLUMN "seo_id" uuid;--> statement-breakpoint
ALTER TABLE "content_article_tags" ADD CONSTRAINT "content_article_tags_source_id_content_article_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article_tags" ADD CONSTRAINT "content_article_tags_target_id_content_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_comment" ADD CONSTRAINT "content_comment_article_id_content_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_article_tags_target_idx" ON "content_article_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_author_workspace_idx" ON "content_author" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_comment_workspace_idx" ON "content_comment" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_seo_meta_workspace_idx" ON "content_seo_meta" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_tag_workspace_idx" ON "content_tag" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_author_id_content_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."content_author"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_seo_id_content_seo_meta_id_fk" FOREIGN KEY ("seo_id") REFERENCES "public"."content_seo_meta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_seo_id_unique" UNIQUE("seo_id");