CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'audio', 'document', 'archive');--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"folder_id" uuid,
	"name" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"storage_provider" text NOT NULL,
	"checksum" text,
	"width" integer,
	"height" integer,
	"duration" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alt" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_folder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_asset_ws_folder_idx" ON "media_asset" USING btree ("workspace_id","folder_id");--> statement-breakpoint
CREATE INDEX "media_folder_ws_parent_idx" ON "media_folder" USING btree ("workspace_id","parent_id");