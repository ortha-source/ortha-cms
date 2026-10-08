CREATE TABLE "throttle_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "throttle_buckets_window_ends_at_idx" ON "throttle_buckets" USING btree ("window_ends_at");