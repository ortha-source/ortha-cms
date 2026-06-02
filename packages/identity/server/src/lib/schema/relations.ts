import { relations } from 'drizzle-orm';
import { permissions } from './permissions';
import { rolePermissions } from './role-permissions';
import { roles } from './roles';

/** A role holds many permission grants. */
export const rolesRelations = relations(roles, ({ many }) => ({
    rolePermissions: many(rolePermissions)
}));

/** A permission is granted to many roles. */
export const permissionsRelations = relations(permissions, ({ many }) => ({
    rolePermissions: many(rolePermissions)
}));

/** Each grant row resolves to exactly one role and one permission. */
export const rolePermissionsRelations = relations(
    rolePermissions,
    ({ one }) => ({
        role: one(roles, {
            fields: [rolePermissions.roleId],
            references: [roles.id]
        }),
        permission: one(permissions, {
            fields: [rolePermissions.permissionId],
            references: [permissions.id]
        })
    })
);
