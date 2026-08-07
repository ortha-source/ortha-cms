import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { copilotConversations } from './conversations';

/**
 * What actually touched data — **the security-review surface**
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md), consequences:
 * "Security review has one surface: `copilot_tool_calls` joined to the activity
 * log"). One row per attempted call, written whether it succeeded, failed, or
 * was refused by the authorize step, because a refused call is exactly the
 * event a reviewer is looking for.
 */
export const copilotToolCalls = pgTable(
    'copilot_tool_calls',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The thread the call was made in. */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => copilotConversations.id, { onDelete: 'cascade' }),
        /** The run the call belongs to. */
        runId: uuid('run_id').notNull(),
        /** The provider-assigned call id, as the model issued it. */
        callId: text('call_id').notNull(),
        /** The tool's name, e.g. `content.searchEntries`. */
        name: text('name').notNull(),
        /** The arguments the model supplied. */
        input: jsonb('input'),
        /**
         * The result, **redacted to a summary** rather than stored whole. A
         * search can return a page of entry bodies, and copying those into an
         * append-only audit table would duplicate content indefinitely and
         * spread anything sensitive in it into a second place with a different
         * deletion story. The transcript already holds what the model saw.
         */
        outputSummary: text('output_summary'),
        /** Whether the call succeeded. */
        ok: boolean('ok').notNull(),
        /** The error message, when it did not. */
        error: text('error'),
        /** How long it took, in milliseconds. */
        durationMs: integer('duration_ms').notNull(),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // "What did this run do?" — the review query, and the UI's step list.
        index('copilot_tool_calls_run_idx').on(table.runId, table.createdAt)
    ]
);
