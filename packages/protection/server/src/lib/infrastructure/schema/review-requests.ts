import {
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Someone asking for their entry to be looked at.
 *
 * Without this table approvals exist and nobody knows they are wanted: it is
 * what fills the reviewer's queue, and until the mail port lands it is the only
 * way a reviewer learns there is work.
 *
 * **`revisionId` is the head at the moment of asking, kept for the trail — the
 * request itself stays open across later saves.** An author who fixes a typo
 * after asking has not withdrawn the request, and re-opening one on every save
 * would make the queue churn for reasons nobody watching it cares about. What
 * expires on a save is the *approval*, not the request.
 *
 * No foreign key to `content_entry_revisions`: that table is **host**-owned —
 * `content-server` emits no migrations for it — and a plugin cannot declare an
 * FK into a table whose migration it does not own. Nor to `workspaces` or
 * `users`, for the cross-plugin reason the other two tables give.
 */
export const reviewRequests = pgTable(
    'review_requests',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Every read AND-s this in. */
        workspaceId: uuid('workspace_id').notNull(),
        contentType: text('content_type').notNull(),
        /** The live entry row — one per locale, as revisions are. */
        entryId: uuid('entry_id').notNull(),
        /** The head revision when the request was opened. Trail only. */
        revisionId: uuid('revision_id').notNull(),
        requestedBy: uuid('requested_by').notNull(),
        /**
         * The people asked to review, in the order they were picked.
         *
         * An array on the request rather than a table of its own: the set is
         * small, it is always read and written whole with its request, and it
         * never changes whose approval counts — anyone holding
         * `content:approve` may still approve. It says who was asked, which is
         * what the entry panel shows and what "Waiting on me" filters by.
         */
        reviewerIds: uuid('reviewer_ids')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Set when the entry publishes, or when the requester withdraws. */
        resolvedAt: timestamp('resolved_at', { withTimezone: true })
    },
    (table) => [
        // One *open* request per entry: asking twice updates the reviewers rather
        // than stacking a second row into the reviewer's queue. Partial, so a
        // resolved request stays as history and does not block the next ask.
        uniqueIndex('review_requests_open_entry_unique')
            .on(table.entryId)
            .where(sql`${table.resolvedAt} is null`),
        // The reviewer page: every open request in the workspace, all types.
        index('review_requests_workspace_open_idx').on(
            table.workspaceId,
            table.resolvedAt
        )
    ]
);
