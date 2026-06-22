CREATE TABLE "content_article_related" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "content_article_related_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"reading_minutes" integer,
	"price" integer,
	"featured" boolean,
	"review_due_on" date,
	"published_at" timestamp with time zone,
	"format" text NOT NULL,
	"extra" jsonb,
	"hero_image" text,
	"hero_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_landing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"headline" text NOT NULL,
	"intro" text,
	"hero_rank" integer,
	"budget" integer,
	"live" boolean DEFAULT false NOT NULL,
	"launch_on" date,
	"publish_at" timestamp with time zone,
	"theme" text,
	"meta" jsonb,
	"og_image" text,
	"feature_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_landing_picks" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "content_landing_picks_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
ALTER TABLE "content_article_related" ADD CONSTRAINT "content_article_related_source_id_content_article_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article_related" ADD CONSTRAINT "content_article_related_target_id_content_article_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_article" ADD CONSTRAINT "content_article_hero_id_content_landing_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."content_landing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_landing" ADD CONSTRAINT "content_landing_feature_id_content_article_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."content_article"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_landing_picks" ADD CONSTRAINT "content_landing_picks_source_id_content_landing_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_landing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_landing_picks" ADD CONSTRAINT "content_landing_picks_target_id_content_article_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_article_related_target_idx" ON "content_article_related" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_article_workspace_status_idx" ON "content_article" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_landing_workspace_status_idx" ON "content_landing" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_landing_picks_target_idx" ON "content_landing_picks" USING btree ("target_id");