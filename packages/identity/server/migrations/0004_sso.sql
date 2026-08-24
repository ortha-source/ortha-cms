CREATE TABLE "sso_auth_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"state" text NOT NULL,
	"nonce" text NOT NULL,
	"code_verifier" text NOT NULL,
	"redirect_to" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sso_auth_requests_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "sso_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sso_auth_requests_expires_at_idx" ON "sso_auth_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_identities_provider_subject_unique" ON "sso_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_identities_provider_user_unique" ON "sso_identities" USING btree ("provider","user_id");--> statement-breakpoint
CREATE INDEX "sso_identities_user_id_idx" ON "sso_identities" USING btree ("user_id");