import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The append-only audit trail. One row per recorded action.
 *
 * Deliberate isolation choices (the audit log must outlive what it records):
 * - `actorId` is a uuid with **no FK** — the actor may later be deleted, but
 *   the audit row must remain.
 * - `actorEmail` is a frozen snapshot of the actor's email at record time, so
 *   the trail stays readable even after the user row is gone or renamed.
 * - `subjectId` is **text**, not uuid — subjects are not always users and not
 *   always uuid-keyed.
 * - `meta` is an open jsonb payload; each emitting plugin owns its shape.
 * - `at` is the logical event time (defaults to now); `createdAt` is the
 *   immutable write time, dropped from the read API.
 *
 * Indexed for the three query shapes the read API serves: a subject's history,
 * an actor's history, and a kind's history — each time-ordered.
 */
export const activityEvents = pgTable(
    'activity_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        kind: text('kind').notNull(),
        subjectType: text('subject_type').notNull(),
        subjectId: text('subject_id').notNull(),
        actorId: uuid('actor_id'),
        actorEmail: text('actor_email'),
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
        index('activity_events_kind_idx').on(table.kind, table.at)
    ]
);
