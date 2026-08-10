CREATE TABLE "content_test_article_contributors" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "content_test_article_contributors_pair_unique" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
ALTER TABLE "content_test_article_contributors" ADD CONSTRAINT "content_test_article_contributors_source_id_content_test_article_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_test_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_test_article_contributors" ADD CONSTRAINT "content_test_article_contributors_target_id_content_test_author_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_test_author"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_test_article_contributors_target_idx" ON "content_test_article_contributors" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "content_test_article_contributors_source_pos_idx" ON "content_test_article_contributors" USING btree ("source_id","position");