import { inArray } from 'drizzle-orm';
import type { Database } from '@ortha-cms/database';
import { permissions, rolePermissions, roles } from '../schema';
import { PERMISSION_KEYS, SYSTEM_ROLES } from './system-roles';

/**
 * Idempotently seeds the permission catalogue, the three system roles, and
 * the grants between them. Safe to run on every boot: every write is an
 * `ON CONFLICT DO NOTHING`, so a second run changes nothing — and it stays
 * correct if several instances boot at once (no read-then-write race).
 * Runs in one transaction so a crash can never leave a role without its
 * grants (a privilege gap).
 */
export async function seedSystemRoles(db: Database): Promise<void> {
    await db.transaction(async (tx) => {
        // 1. Permission catalogue.
        await tx
            .insert(permissions)
            .values(PERMISSION_KEYS.map((key) => ({ key })))
            .onConflictDoNothing({ target: permissions.key });

        // 2. System roles.
        await tx
            .insert(roles)
            .values(
                SYSTEM_ROLES.map(({ key, name }) => ({
                    key,
                    name,
                    isSystem: true
                }))
            )
            .onConflictDoNothing({ target: roles.key });

        // 3. Resolve ids. Rows may already exist from a prior boot, so we
        //    SELECT rather than rely on INSERT ... RETURNING. Sequential on
        //    purpose: a transaction runs on a single pg client.
        const roleKeys = SYSTEM_ROLES.map((role) => role.key);
        const roleRows = await tx
            .select({ id: roles.id, key: roles.key })
            .from(roles)
            .where(inArray(roles.key, roleKeys));
        const permRows = await tx
            .select({ id: permissions.id, key: permissions.key })
            .from(permissions)
            .where(inArray(permissions.key, [...PERMISSION_KEYS]));

        const roleId = new Map(roleRows.map((row) => [row.key, row.id]));
        const permId = new Map(permRows.map((row) => [row.key, row.id]));

        // 4. Grants — the composite PK makes the insert a no-op on re-run.
        //    Both ids are guaranteed by steps 1–2 (same transaction); the
        //    guard turns an impossible-state bug into a clear error rather
        //    than silently inserting a null FK.
        const grants = SYSTEM_ROLES.flatMap((role) =>
            role.permissions.map((key) => {
                const grantRoleId = roleId.get(role.key);
                const grantPermissionId = permId.get(key);
                if (!grantRoleId || !grantPermissionId) {
                    throw new Error(
                        `Seed failed: unresolved id for ${role.key} → ${key}`
                    );
                }
                return {
                    roleId: grantRoleId,
                    permissionId: grantPermissionId
                };
            })
        );

        if (grants.length > 0) {
            await tx
                .insert(rolePermissions)
                .values(grants)
                .onConflictDoNothing();
        }
    });
}
