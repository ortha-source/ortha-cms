import { sql } from 'drizzle-orm';
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * One thing somebody was told, and whether they have looked.
 *
 * **No foreign keys out of this table.** `user_id` is identity's,
 * `workspace_id` the workspaces plugin's, and cross-plugin FKs are not how this
 * codebase scopes rows; `InboxWorkspacePurger` removes a deleted workspace's
 * items instead, and the list reads only workspaces the person still belongs
 * to.
 */
export const inboxItems = pgTable(
    'inbox_items',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Whose inbox. */
        userId: uuid('user_id').notNull(),
        /** The workspace it concerns, or `null` for one that concerns none. */
        workspaceId: uuid('workspace_id'),
        /** An `INBOX_KINDS` value. Text, not an enum: a kind is code, not a migration. */
        kind: text('kind').notNull(),
        /** The tab it files under — derived from `kind` at write, kept for the counts. */
        category: text('category').notNull(),
        /** What the admin renders the sentence from. */
        payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
        /** App-relative path the item opens. */
        link: text('link').notNull(),
        /**
         * The item's identity per recipient, so a retried delivery stores it
         * once. Unique with `user_id`.
         */
        dedupeKey: text('dedupe_key').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** When the person opened it or marked it read; `null` while unread. */
        readAt: timestamp('read_at', { withTimezone: true })
    },
    (table) => [
        uniqueIndex('inbox_items_user_dedupe_key').on(
            table.userId,
            table.dedupeKey
        ),
        // The page: one person's items, newest first.
        index('inbox_items_user_created_idx').on(
            table.userId,
            table.createdAt.desc()
        ),
        // The badge: one person's unread items.
        index('inbox_items_user_unread_idx')
            .on(table.userId, table.category)
            .where(sql`${table.readAt} is null`),
        index('inbox_items_workspace_idx').on(table.workspaceId)
    ]
);
