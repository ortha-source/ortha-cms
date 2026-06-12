import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { permissions, rolePermissions } from '../../schema';
import type { PermissionKey } from '../system-roles';

/**
 * Permission lookups for the identity plugin. Resolves which permission keys
 * a role holds by reading the seeded `role_permissions → permissions` join —
 * the single authorization source both the `/auth/me` payload (admin UI
 * gating) and {@link PermissionsGuard} (server enforcement) read from.
 */
@Injectable()
export class PermissionsService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Lists the permission keys granted to a role, ordered for stable
     * responses. Unknown role ids resolve to an empty grant — fail closed —
     * rather than throwing, since callers only ever branch on membership.
     */
    async keysForRole(roleId: string): Promise<PermissionKey[]> {
        const rows = await this.db
            .select({ key: permissions.key })
            .from(rolePermissions)
            .innerJoin(
                permissions,
                eq(rolePermissions.permissionId, permissions.id)
            )
            .where(eq(rolePermissions.roleId, roleId))
            .orderBy(permissions.key);

        // The seeder only writes catalogue keys, so the cast is safe.
        return rows.map((row) => row.key as PermissionKey);
    }

    /** Whether the role holds the given permission. */
    async can(roleId: string, key: PermissionKey): Promise<boolean> {
        const keys = await this.keysForRole(roleId);
        return keys.includes(key);
    }
}
