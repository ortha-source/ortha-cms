import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * The append-only audit trail. One row per recorded action.
 *
 * Deliberate isolation choices (the audit log must outlive what it records):
 * - `actorId` is a uuid with **no FK** — the actor may later be deleted, but
 *   the audit row must remain.
 * - `actorType` says what `actorId` names — a person (`user`) or an API
 *   credential (`api_token`). Without it `actor_id` meant "a users row" and
 *   nothing else, so a write made with a bearer token had to pass **no** actor
 *   rather than name a person who did not do it: every write over the public
 *   REST API, GraphQL and MCP was recorded as "System", and which of a
 *   workspace's tokens did it was not recoverable from anywhere. It is nullable
 *   because a system-initiated event still has no actor at all, and because
 *   every row written before this column existed names a user.
 * - `actorEmail` is a frozen snapshot of the actor's email at record time, so
 *   the trail stays readable even after the user row is gone or renamed.
 * - `subjectId` is **text**, not uuid — subjects are not always users and not
 *   always uuid-keyed.
 * - `workspaceId` is the workspace the action happened in, or `null` when it
 *   happened in none. The trail records invites, role changes and workspace
 *   lifecycle alongside content edits and **several of those belong to no
 *   workspace at all**, which is why this is nullable and why it is not a
 *   scoping boundary: the log stays deployment-wide and `activity:read`
 *   remains what bounds it. What the column buys is the ability to *ask* a
 *   workspace-shaped question — "what happened in this workspace" — which
 *   previously had no answer at any price, and which is why the content
 *   insights punchcard reads the revision table instead of this one. Populated
 *   from the emitting event's own `payload.workspaceId`; a producer that has a
 *   workspace puts it there.
 * - `meta` is an open jsonb payload; each emitting plugin owns its shape.
 * - `at` is the logical event time (defaults to now); `createdAt` is the
 *   immutable write time, dropped from the read API.
 *
 * Indexed for the four query shapes the read API serves: a subject's history,
 * an actor's history, a kind's history, and a workspace's history — each
 * time-ordered.
 */
export const activityEvents = pgTable(
    'activity_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        kind: text('kind').notNull(),
        subjectType: text('subject_type').notNull(),
        subjectId: text('subject_id').notNull(),
        actorId: uuid('actor_id'),
        actorType: text('actor_type'),
        actorEmail: text('actor_email'),
        workspaceId: uuid('workspace_id'),
        meta: jsonb('meta'),
        at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        index('activity_events_subject_idx').on(
            table.subjectType,
            table.subjectId,
            table.at
        ),
        index('activity_events_actor_idx').on(table.actorId, table.at),
        index('activity_events_kind_idx').on(table.kind, table.at),
        index('activity_events_workspace_idx').on(table.workspaceId, table.at)
    ]
);
