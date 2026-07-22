CREATE TABLE "content_test_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"parent_id" uuid,
	"owner_id" uuid
);
--> statement-breakpoint
ALTER TABLE "content_test_page" ADD CONSTRAINT "content_test_page_parent_id_content_test_page_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_test_page"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_test_page" ADD CONSTRAINT "content_test_page_owner_id_content_test_author_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."content_test_author"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_test_page_workspace_idx" ON "content_test_page" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_test_page_parent_id_idx" ON "content_test_page" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "content_test_page_owner_id_idx" ON "content_test_page" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "content_test_article_author_id_idx" ON "content_test_article" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "content_test_comment_article_id_idx" ON "content_test_comment" USING btree ("article_id");