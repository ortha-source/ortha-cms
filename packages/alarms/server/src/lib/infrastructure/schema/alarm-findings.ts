import {
    index,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { alarmRules } from './alarm-rules';

/**
 * One rule's verdict about one entry.
 *
 * **The primary key is the whole idempotency story.** Outbox delivery is
 * at-least-once, so the evaluator may be handed the same `entry.updated` twice;
 * an upsert on `(rule_id, entry_id)` makes the second pass a no-op instead of a
 * duplicate row. It is also what makes the state machine work: `firstSeenAt` is
 * written on insert and never again, so "this has been open for three months"
 * survives resolution and re-opening.
 *
 * `entryId` has no FK: entries live in the host-owned generated
 * `content_<name>` tables, one per type, so there is no single table to point
 * at. The `entry.deleted` / `entry.purged` subscribers keep it honest instead.
 */
export const alarmFindings = pgTable(
    'alarm_findings',
    {
        ruleId: uuid('rule_id')
            .notNull()
            .references(() => alarmRules.id, { onDelete: 'cascade' }),
        entryId: uuid('entry_id').notNull(),
        workspaceId: uuid('workspace_id').notNull(),
        contentType: text('content_type').notNull(),
        state: text('state').notNull(),
        /** What the rule found — the field or relation that tripped it. */
        detail: jsonb('detail'),
        firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        resolvedAt: timestamp('resolved_at', { withTimezone: true })
    },
    (table) => [
        primaryKey({ columns: [table.ruleId, table.entryId] }),
        // The alarms page: a workspace's findings, filtered by state, grouped
        // by rule.
        index('alarm_findings_workspace_state_idx').on(
            table.workspaceId,
            table.state,
            table.ruleId
        ),
        // The entry editor's sidebar widget and the records column, which ask
        // "what is open on these entries" and never care about resolved rows.
        index('alarm_findings_entry_idx').on(table.entryId, table.state)
    ]
);
