-- Muting a finding is gone. An alarm is either right about a record or wrong
-- about it; silencing one record at a time is a way of living with a bad
-- condition instead of fixing it.
--
-- Rows still carrying the retired state come back into view as open, which is
-- the honest outcome of withdrawing the feature — and it has to happen *before*
-- the columns go, because after that there is nothing left to identify them by.
-- Without it those rows would sit in a `state` no code recognises: excluded
-- from every `state = 'open'` count, yet included by the list's
-- `state <> 'resolved'`, so a workspace's badge and its list would disagree.
UPDATE "alarm_findings" SET "state" = 'open' WHERE "state" = 'muted';--> statement-breakpoint
ALTER TABLE "alarm_findings" DROP COLUMN "muted_at";--> statement-breakpoint
ALTER TABLE "alarm_findings" DROP COLUMN "muted_by";--> statement-breakpoint
ALTER TABLE "alarm_findings" DROP COLUMN "muted_reason";
