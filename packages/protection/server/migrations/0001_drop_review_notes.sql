-- Hand-edited: a row in review_approvals is an approval from here on. The
-- "changes requested" votes are deleted before `decision` is dropped — dropping
-- the column alone would silently turn every one of them into an approval.
DELETE FROM "review_approvals" WHERE "decision" <> 'approved';--> statement-breakpoint
ALTER TABLE "review_approvals" DROP CONSTRAINT "review_approvals_decision_check";--> statement-breakpoint
ALTER TABLE "review_approvals" DROP COLUMN "decision";--> statement-breakpoint
ALTER TABLE "review_approvals" DROP COLUMN "note";--> statement-breakpoint
ALTER TABLE "review_requests" DROP COLUMN "note";