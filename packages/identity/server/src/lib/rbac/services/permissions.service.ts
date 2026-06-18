import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { permissions, rolePermissions } from '../../schema';
import type { PermissionKey } from '../system-roles';

/**
 * Resolves what a role is allowed to do. Reads the `role_permissions` grants
 * seeded by {@link seedSystemRoles}; the `PermissionsGuard` and `GET /auth/me`
 * both consume it so "what can this user do?" has one source of truth.
 */
@Injectable()
export class PermissionsService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** The permission keys granted to `roleId`. */
    async forRole(roleId: string): Promise<PermissionKey[]> {
        const rows = await this.db
            .select({ key: permissions.key })
            .from(rolePermissions)
            .innerJoin(
                permissions,
                eq(permissions.id, rolePermissions.permissionId)
            )
            .where(eq(rolePermissions.roleId, roleId));
        return rows.map((row) => row.key as PermissionKey);
    }
}
