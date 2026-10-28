CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"payload" jsonb NOT NULL,
	"link" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_items_user_dedupe_key" ON "inbox_items" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "inbox_items_user_created_idx" ON "inbox_items" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inbox_items_user_unread_idx" ON "inbox_items" USING btree ("user_id","category") WHERE "inbox_items"."read_at" is null;--> statement-breakpoint
CREATE INDEX "inbox_items_workspace_idx" ON "inbox_items" USING btree ("workspace_id");