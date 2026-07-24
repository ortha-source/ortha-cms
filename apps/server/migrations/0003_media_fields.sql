ALTER TABLE "content_article" ADD COLUMN "cover_image" uuid;--> statement-breakpoint
ALTER TABLE "content_article" ADD COLUMN "localized_hero" uuid;--> statement-breakpoint
ALTER TABLE "content_article" ADD COLUMN "gallery" jsonb;--> statement-breakpoint
ALTER TABLE "content_master_collection" ADD COLUMN "hero_image" uuid;--> statement-breakpoint
ALTER TABLE "content_master_collection" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "content_master_collection" ADD COLUMN "brochure" uuid;