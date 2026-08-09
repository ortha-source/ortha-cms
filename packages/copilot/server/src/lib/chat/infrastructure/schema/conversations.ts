import {
    boolean,
    index,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { users, workspaces } from './external-refs';

/**
 * One chat thread, scoped to a **user × workspace**. There is no sharing in
 * v1: a conversation belongs to the person who started it, and every read is
 * filtered by both columns, so a valid session for workspace A can never reach
 * a thread in workspace B.
 *
 * Both foreign keys cascade — deleting a user or a workspace takes their
 * transcripts with it, which is the behaviour a deletion request needs.
 */
export const copilotConversations = pgTable(
    'copilot_conversations',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The owning user. Threads are private to them. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** The workspace the thread's runs are scoped to. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /**
         * Display title. Null until the first turn names it — derived from the
         * opening user message rather than costing a model call.
         */
        title: text('title'),
        /**
         * Where the thread was started from (`chat`, `palette`, `entry`, …).
         * Recorded now because a thread continued from an inline entry point
         * should still render as the surface it came from (design §2).
         */
        surface: text('surface').notNull().default('chat'),
        /** Hidden from the list without losing the transcript. */
        archived: boolean('archived').notNull().default(false),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /**
         * Bumped on every turn, so the thread list can sort by recency without
         * joining the messages table.
         */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // The thread list's exact query: this user's threads in this
        // workspace, most recently used first.
        index('copilot_conversations_owner_idx').on(
            table.userId,
            table.workspaceId,
            table.updatedAt
        )
    ]
);
