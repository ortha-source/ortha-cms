CREATE TABLE "content_entry_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"entry_id" uuid NOT NULL,
	"locale_group_id" uuid,
	"locale" text,
	"revision_number" integer NOT NULL,
	"status" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "content_entry_revisions_entry_number_uq" UNIQUE("entry_id","revision_number")
);
--> statement-breakpoint
CREATE INDEX "content_entry_revisions_entry_idx" ON "content_entry_revisions" USING btree ("entry_id","revision_number");--> statement-breakpoint
CREATE INDEX "content_entry_revisions_workspace_idx" ON "content_entry_revisions" USING btree ("workspace_id","content_type");