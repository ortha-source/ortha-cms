import { Controller, Get, UseGuards } from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    SYSTEM_ROLES
} from '@orthacms/identity-server';
import { ASSIGNABLE_ROLE_KEYS } from '../../domain/value-objects/role';
import type { RoleCatalogEntryView } from '../../application/queries/member.view';

/**
 * `GET /api/users/roles` — the three assignable system roles and the
 * permission keys each grants, so the admin's role-change dialog can show
 * **what actually changes** instead of a bare "are you sure?".
 *
 * Read from identity's `SYSTEM_ROLES`, the matrix the seeder reconciles the
 * database to in both directions, so this cannot drift from the grants the
 * guard enforces. `users:read`, like the roster: which permissions a role
 * carries is not a secret from anyone who can see who holds it.
 *
 * **Registered ahead of `GetMemberController`.** Both answer `GET /users/…`,
 * and Express tries routes in registration order: behind `/:id`'s
 * `ParseUUIDPipe`, `roles` would be a 400, not a fall-through.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.USERS_READ)
@Controller('users')
export class RoleCatalogController {
    @Get('roles')
    list(): { items: RoleCatalogEntryView[] } {
        const assignable = new Set<string>(ASSIGNABLE_ROLE_KEYS);
        return {
            items: SYSTEM_ROLES.filter((role) => assignable.has(role.key)).map(
                (role) => ({
                    key: role.key,
                    name: role.name,
                    permissions: [...role.permissions]
                })
            )
        };
    }
}
