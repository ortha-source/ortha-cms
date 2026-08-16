DROP INDEX "outbox_events_dispatched_at_idx";--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("occurred_at") WHERE "outbox_events"."dispatched_at" is null;