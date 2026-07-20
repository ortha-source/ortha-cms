CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_events_subject_idx" ON "activity_events" USING btree ("subject_type","subject_id","at");--> statement-breakpoint
CREATE INDEX "activity_events_actor_idx" ON "activity_events" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "activity_events_kind_idx" ON "activity_events" USING btree ("kind","at");