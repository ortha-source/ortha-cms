ALTER TABLE "sessions" ADD COLUMN "sso_provider" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "sso_session_id" text;--> statement-breakpoint
CREATE INDEX "sessions_sso_session_idx" ON "sessions" USING btree ("sso_provider","sso_session_id");