import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * The transactional outbox. A state change and the events it emits are
 * written here in the **same** transaction, so the row commits iff the
 * change does. The `OutboxDispatcher` later drains undispatched rows and
 * delivers them to subscribers — decoupling side effects from the write
 * without a two-phase commit.
 *
 * This is the **one** table `@ortha-cms/database` owns (the sanctioned
 * exception to "database owns no schema"): the outbox is infrastructure
 * shared by every bounded context, not any one domain's data.
 */
export const outboxEvents = pgTable(
    'outbox_events',
    {
        /** Primary key — the event's `eventId`, doubling as the idempotency key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Event kind, e.g. `'workspace.created'`. */
        kind: text('kind').notNull(),
        /** The aggregate root's type. */
        aggregateType: text('aggregate_type').notNull(),
        /** The aggregate root's id. */
        aggregateId: text('aggregate_id').notNull(),
        /** Event-specific JSON payload. */
        payload: jsonb('payload').notNull(),
        /** When the fact occurred (domain time). Drives the drain order. */
        occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
        /** When the event was delivered to all subscribers; null until then. */
        dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
        /** Failed delivery attempts, for observability and backoff. */
        attempts: integer('attempts').notNull().default(0)
    },
    (table) => [
        // The drain query filters on `dispatched_at IS NULL`; index it so
        // scanning for pending rows stays cheap as delivered rows accumulate.
        index('outbox_events_dispatched_at_idx').on(table.dispatchedAt)
    ]
);
