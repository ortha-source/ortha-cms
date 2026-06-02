import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { permissions } from './permissions';
import { roles } from './roles';

/**
 * role ↔ permission join (M:N). Each row grants one permission to one
 * role. The composite primary key prevents duplicate grants; cascade
 * deletes drop grants when either side is removed.
 */
export const rolePermissions = pgTable(
    'role_permissions',
    {
        /** References the granted role. */
        roleId: uuid('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' }),
        /** References the granted permission. */
        permissionId: uuid('permission_id')
            .notNull()
            .references(() => permissions.id, { onDelete: 'cascade' }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);
