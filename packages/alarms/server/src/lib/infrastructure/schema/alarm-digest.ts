import { sql } from 'drizzle-orm';
import {
    check,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * How often a person receives the alarm digest (ADR-0023). One row per person
 * who changed it; no row reads as the default, `daily`. No FK to `users`, as
 * no column here points into another plugin's schema.
 */
export const alarmDigestSettings = pgTable(
    'alarm_digest_settings',
    {
        userId: uuid('user_id').primaryKey(),
        frequency: text('frequency').notNull().default('daily'),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        check(
            'alarm_digest_settings_frequency_check',
            sql`${table.frequency} in ('daily', 'weekly', 'off')`
        )
    ]
);

/**
 * One digest period claimed for one person — the row that makes "once per
 * period" true across processes. The digest loop runs in every API process
 * (ADR-0015 says as much of the sweep); whichever inserts the
 * `(user_id, period_key)` row first sends, and the others find it taken.
 * `created_at` is also where the next digest's "since" starts.
 */
export const alarmDigestRuns = pgTable(
    'alarm_digest_runs',
    {
        userId: uuid('user_id').notNull(),
        /** `2026-10-28` for a daily period, `week-2026-10-26` for a weekly one. */
        periodKey: text('period_key').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [primaryKey({ columns: [table.userId, table.periodKey] })]
);
