CREATE TABLE "content_author" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"bio" text,
	"avatar" text,
	"joined_on" date,
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_home_featured_posts" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "content_home_featured_posts_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_home" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"headline" text NOT NULL,
	"intro" text
);
--> statement-breakpoint
CREATE TABLE "content_post_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "content_post_tags_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text,
	"author_id" uuid NOT NULL,
	"hero_image" text,
	"published_at" timestamp with time zone,
	"review_due_on" date,
	"sponsorship_price" integer,
	"reading_minutes" integer,
	"featured" boolean,
	"format" text NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"color" text
);
--> statement-breakpoint
ALTER TABLE "content_home_featured_posts" ADD CONSTRAINT "content_home_featured_posts_source_id_content_home_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_home_featured_posts" ADD CONSTRAINT "content_home_featured_posts_target_id_content_post_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post_tags" ADD CONSTRAINT "content_post_tags_source_id_content_post_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post_tags" ADD CONSTRAINT "content_post_tags_target_id_content_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_author_id_content_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."content_author"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_author_workspace_status_idx" ON "content_author" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_home_featured_posts_target_idx" ON "content_home_featured_posts" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_home_workspace_status_idx" ON "content_home" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_post_tags_target_idx" ON "content_post_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_post_workspace_status_idx" ON "content_post" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_tag_workspace_status_idx" ON "content_tag" USING btree ("workspace_id","status");