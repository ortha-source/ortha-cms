import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A media folder within a workspace. `parentId` null = a top-level (root)
 * folder — there is no synthetic root row. `workspaceId` is a plain uuid with
 * no cross-plugin FK (the `workspaces` table is identity-owned); scoping is
 * enforced in the application layer, as with the content tables.
 */
export const mediaFolder = pgTable(
    'media_folder',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: uuid('workspace_id').notNull(),
        parentId: uuid('parent_id'),
        name: text('name').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (table) => [
        index('media_folder_ws_parent_idx').on(
            table.workspaceId,
            table.parentId
        )
    ]
);
