CREATE TABLE "content_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"text" text NOT NULL,
	"richtext" text,
	"number" integer,
	"money" integer,
	"boolean" boolean,
	"date" date,
	"datetime" timestamp with time zone,
	"select" text NOT NULL,
	"multiselect" jsonb,
	"json" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_landing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text NOT NULL,
	"richtext" text,
	"number" integer,
	"money" integer,
	"boolean" boolean DEFAULT false NOT NULL,
	"date" date,
	"datetime" timestamp with time zone,
	"select" text,
	"multiselect" jsonb,
	"json" jsonb
);
--> statement-breakpoint
CREATE INDEX "content_article_workspace_status_idx" ON "content_article" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "content_landing_workspace_idx" ON "content_landing" USING btree ("workspace_id");