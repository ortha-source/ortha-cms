CREATE TABLE "content_test_review_tags" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_test_review_tags_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "content_test_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"title" text,
	"seo_id" uuid
);
--> statement-breakpoint
ALTER TABLE "content_test_review_tags" ADD CONSTRAINT "content_test_review_tags_source_id_content_test_review_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_test_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_test_review_tags" ADD CONSTRAINT "content_test_review_tags_target_id_content_test_tag_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_test_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_test_review" ADD CONSTRAINT "content_test_review_seo_id_content_test_seo_id_fk" FOREIGN KEY ("seo_id") REFERENCES "public"."content_test_seo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_test_review_tags_target_idx" ON "content_test_review_tags" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_test_review_tags_source_pos_idx" ON "content_test_review_tags" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "content_test_review_workspace_status_idx" ON "content_test_review" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_test_review_seo_id_idx" ON "content_test_review" USING btree ("seo_id");