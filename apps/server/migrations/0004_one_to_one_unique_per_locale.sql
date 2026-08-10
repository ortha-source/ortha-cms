ALTER TABLE "content_article" DROP CONSTRAINT "content_article_seo_id_unique";--> statement-breakpoint
ALTER TABLE "content_master_collection" DROP CONSTRAINT "content_master_collection_seo_id_unique";--> statement-breakpoint
ALTER TABLE "content_master_single" DROP CONSTRAINT "content_master_single_seo_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "content_article_seo_locale_unique" ON "content_article" USING btree ("seo_id","locale") WHERE "content_article"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "content_master_collection_seo_locale_unique" ON "content_master_collection" USING btree ("seo_id","locale") WHERE "content_master_collection"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "content_master_single_seo_locale_unique" ON "content_master_single" USING btree ("seo_id","locale") WHERE "content_master_single"."deleted_at" is null;