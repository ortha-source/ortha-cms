CREATE INDEX "content_article_author_id_idx" ON "content_article" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "content_article_category_id_idx" ON "content_article" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "content_category_parent_id_idx" ON "content_category" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "content_comment_article_id_idx" ON "content_comment" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "content_home_page_featured_id_idx" ON "content_home_page" USING btree ("featured_id");--> statement-breakpoint
CREATE INDEX "content_master_collection_owner_id_idx" ON "content_master_collection" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "content_master_collection_parent_id_idx" ON "content_master_collection" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "content_master_single_curator_id_idx" ON "content_master_single" USING btree ("curator_id");