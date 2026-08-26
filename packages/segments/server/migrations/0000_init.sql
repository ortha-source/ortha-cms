CREATE TABLE "entry_access" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type_slug" text NOT NULL,
	"allow" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deny" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "entry_access_allow_idx" ON "entry_access" USING gin ("allow");--> statement-breakpoint
CREATE INDEX "entry_access_deny_idx" ON "entry_access" USING gin ("deny");--> statement-breakpoint
CREATE INDEX "entry_access_scope_idx" ON "entry_access" USING btree ("workspace_id","type_slug");--> statement-breakpoint
CREATE INDEX "segments_label_idx" ON "segments" USING btree ("label");