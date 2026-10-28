CREATE TABLE "alarm_digest_runs" (
	"user_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alarm_digest_runs_user_id_period_key_pk" PRIMARY KEY("user_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "alarm_digest_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alarm_digest_settings_frequency_check" CHECK ("alarm_digest_settings"."frequency" in ('daily', 'weekly', 'off'))
);
