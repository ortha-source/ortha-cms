CREATE TABLE "content_microsteps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"locale" text NOT NULL,
	"locale_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"description" jsonb,
	"articles_id" uuid,
	"image" uuid,
	"depricated_at" date
);
--> statement-breakpoint
ALTER TABLE "content_microsteps" ADD CONSTRAINT "content_microsteps_articles_id_content_article_id_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."content_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_microsteps_workspace_locale_idx" ON "content_microsteps" USING btree ("workspace_id","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_microsteps_group_locale_unique" ON "content_microsteps" USING btree ("locale_group_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "content_microsteps_articles_locale_unique" ON "content_microsteps" USING btree ("articles_id","locale");