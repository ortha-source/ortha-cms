import {
    index,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * One reviewer's approval, on one **revision**.
 *
 * A row **is** an approval: there is no decision column. _Request changes_ and
 * the notes that went with it were removed — a refusal with no sentence saying
 * what to change carried nothing, and a reviewer who is not satisfied simply
 * does not approve.
 *
 * `revisionId` is the column the whole feature turns on. An approval bound to
 * the entry would outlive the edit it approved — the mistake every CMS that
 * ships approvals makes — so it is bound to the version instead, and a save
 * writes a new revision, which drops the vote off the head with **no dismissal
 * logic anywhere**. Nothing is deleted: the row survives so the interface can
 * strike the name through and say which version it was given on, because a
 * counter that silently rolls back is unexplainable to the person who just
 * pressed Save.
 *
 * **No foreign key to `content_entry_revisions`.** It is host-owned —
 * `content-server` emits no migrations for it, the host's drizzle config
 * re-exports it into the diff — and a plugin cannot declare an FK into a table
 * whose migration it does not own. The integrity that matters here is not
 * referential anyway: a deleted revision leaves an approval that matches no
 * head, which is exactly the wanted behaviour.
 *
 * `workspaceId`, `contentType` and `entryId` are **denormalised** so the
 * reviewer queue and the records-list column can count votes without joining to
 * a table this package does not own.
 */
export const reviewApprovals = pgTable(
    'review_approvals',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: uuid('workspace_id').notNull(),
        contentType: text('content_type').notNull(),
        entryId: uuid('entry_id').notNull(),
        /** What makes an approval expire. */
        revisionId: uuid('revision_id').notNull(),
        userId: uuid('user_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // One approval per person per version, refreshed by upsert rather than a
        // second row. It is also what lets the domain count distinct people
        // cheaply on the head — and what makes the *stale* count meaningful,
        // since a person approving five versions in a row is still one person.
        unique('review_approvals_revision_user_unique').on(
            table.revisionId,
            table.userId
        ),
        // The editor's question: every vote on this entry, whatever revision.
        index('review_approvals_workspace_entry_idx').on(
            table.workspaceId,
            table.entryId
        )
    ]
);
