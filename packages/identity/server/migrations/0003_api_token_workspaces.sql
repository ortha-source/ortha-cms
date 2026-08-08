CREATE TABLE "api_token_workspaces" (
	"token_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "api_token_workspaces_token_id_workspace_id_pk" PRIMARY KEY("token_id","workspace_id")
);
--> statement-breakpoint
DROP INDEX "api_tokens_workspace_id_idx";--> statement-breakpoint
ALTER TABLE "api_token_workspaces" ADD CONSTRAINT "api_token_workspaces_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_token_workspaces_workspace_id_idx" ON "api_token_workspaces" USING btree ("workspace_id");--> statement-breakpoint
--> Backfill: every existing token's single workspace becomes its first bucket
--> row. Hand-added to the generated diff — drizzle-kit only emits the shape
--> change, and dropping the column without this would silently unscope every
--> live token. Must run BEFORE the DROP COLUMN below.
INSERT INTO "api_token_workspaces" ("token_id", "workspace_id") SELECT "id", "workspace_id" FROM "api_tokens" ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "api_tokens" DROP COLUMN "workspace_id";