import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import {
    users,
    workspaces
} from '../../../chat/infrastructure/schema/external-refs';
import { copilotConversations } from '../../../chat/infrastructure/schema/conversations';

/**
 * The copilot's spend ledger — **one row per run**, written when the run is
 * admitted and added to after every model call.
 *
 * Its own table rather than a sum over `copilot_messages`, which already
 * carries token counts but cannot answer a quota: an assistant row is written
 * only when the run ends (so concurrent runs cannot see each other's spend), a
 * run that fails before producing anything writes no row at all (so its spend
 * vanishes), cache writes are not stored, and neither user nor workspace is on
 * the row.
 *
 * The user and workspace keys cascade, as a conversation's do. The
 * conversation is `set null` instead: spend has to outlive the thread it was
 * spent in, or removing a thread would be a way to reset a quota.
 */
export const copilotUsage = pgTable(
    'copilot_usage',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The run this row charges — one row per run. */
        runId: uuid('run_id').notNull().unique(),
        /** Who ran it. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** The workspace it ran in. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /**
         * The thread it ran in. Null until the run's first model call — a new
         * thread is created after admission — and after the thread is gone.
         */
        conversationId: uuid('conversation_id').references(
            () => copilotConversations.id,
            { onDelete: 'set null' }
        ),
        /** Which registered provider served it. */
        provider: text('provider'),
        /** Which model answered. */
        model: text('model'),
        /** Uncached input tokens, across the run. */
        inputTokens: integer('input_tokens').notNull().default(0),
        /** Output tokens, across the run. */
        outputTokens: integer('output_tokens').notNull().default(0),
        /** Input served from a provider cache. Stored, never charged. */
        cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
        /** Input written to a provider cache. Charged. */
        cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
        /**
         * What the quotas count (`billableTokens`), **stored** rather than
         * derived at read time, so a later change to the formula does not
         * rewrite what yesterday cost.
         */
        billableTokens: integer('billable_tokens').notNull().default(0),
        /**
         * `running` from admission until the run ends, then `finished`. A
         * `running` row whose `updated_at` is older than a run can live is an
         * orphan of a process that died — it no longer holds a concurrency
         * slot, and what it recorded is still charged.
         */
        status: text('status').$type<'running' | 'finished'>().notNull(),
        /** Why the run ended. Null while running and on an orphan. */
        stopReason: text('stop_reason'),
        /** When the run was admitted — the day it is charged to. */
        startedAt: timestamp('started_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last write: admission, a model call, or the end. */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** When the run ended. */
        finishedAt: timestamp('finished_at', { withTimezone: true })
    },
    (table) => [
        // A user's spend today in one workspace, and their live runs.
        index('copilot_usage_user_day_idx').on(
            table.userId,
            table.workspaceId,
            table.startedAt
        ),
        // A workspace's spend today.
        index('copilot_usage_workspace_day_idx').on(
            table.workspaceId,
            table.startedAt
        )
    ]
);
