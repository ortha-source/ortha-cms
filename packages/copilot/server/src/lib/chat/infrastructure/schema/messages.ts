import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import type { ModelContentBlock } from '@ortha-cms/copilot-domain';
import { copilotConversations } from './conversations';

/** Who produced a turn. Mirrors the port's `ModelMessage['role']`. */
export const copilotMessageRole = pgEnum('copilot_message_role', [
    'user',
    'assistant'
]);

/**
 * One turn of a conversation — **append-only**. This is the transcript used for
 * replay and audit, so a row is never edited after it is written: a turn that
 * failed keeps its `stopReason`, and a turn that was cancelled keeps whatever
 * text had streamed. Rewriting history here would defeat the point of having it.
 *
 * The user's message is written **before** the model is called (design §5, step
 * 3), so a dropped connection never loses what someone typed.
 */
export const copilotMessages = pgTable(
    'copilot_messages',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The thread this turn belongs to. */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => copilotConversations.id, { onDelete: 'cascade' }),
        /**
         * The run that produced this turn. The user message that opened the
         * run carries the same id, so one run's turns select together.
         */
        runId: uuid('run_id').notNull(),
        /** Who produced the turn. */
        role: copilotMessageRole('role').notNull(),
        /**
         * The turn's content blocks, exactly as the port models them — text,
         * tool_use and tool_result. Stored as the port's shape rather than a
         * provider's, so a transcript survives switching provider.
         */
        content: jsonb('content').$type<ModelContentBlock[]>().notNull(),
        /** Which model produced an assistant turn; null on a user turn. */
        model: text('model'),
        /** Which registered provider served it; null on a user turn. */
        provider: text('provider'),
        /** Why the run ended, on the final assistant turn. */
        stopReason: text('stop_reason'),
        /** Tokens billed as input across the run. */
        inputTokens: integer('input_tokens'),
        /** Tokens the model generated across the run. */
        outputTokens: integer('output_tokens'),
        /**
         * Monotonic position within the thread. Explicit rather than inferred
         * from `createdAt`: two turns of one run can land inside the same
         * millisecond, and a transcript that renders out of order is worse
         * than one that renders slowly.
         */
        position: integer('position').notNull(),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // The transcript read: one thread's turns, in order.
        index('copilot_messages_thread_idx').on(
            table.conversationId,
            table.position
        )
    ]
);
