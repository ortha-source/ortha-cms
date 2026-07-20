import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './external-refs';
import { workspaces } from './workspaces';

/**
 * user ↔ workspace join (M:N). Records only *which* workspaces a user
 * belongs to — the role is global and lives on `users`, not here. Unique
 * on (userId, workspaceId): a user joins a given workspace once.
 */
export const memberships = pgTable(
    'memberships',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** References the member. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** References the workspace. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // (userId, workspaceId) unique — also indexes userId via leftmost
        // prefix, covering "list a user's workspaces".
        unique('memberships_user_workspace_unique').on(
            table.userId,
            table.workspaceId
        ),
        // workspaceId is not covered by the prefix above — index it for
        // "list members of a workspace".
        index('memberships_workspace_id_idx').on(table.workspaceId)
    ]
);
