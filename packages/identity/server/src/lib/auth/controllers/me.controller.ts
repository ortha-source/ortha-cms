import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { PublicUser } from '../services/auth.service';
import { PermissionsService } from '../../rbac/services/permissions.service';
import type { PermissionKey } from '../../rbac/system-roles';

/**
 * The `GET /api/auth/me` payload: the current user plus the permission keys
 * their role grants. Permissions ride along so the admin app can gate pages
 * and controls without a second round-trip; the server still enforces them
 * per-route via `PermissionsGuard` — this field is presentation, not
 * authorization. (A `type` because it derives from {@link PublicUser}.)
 */
export type CurrentUserView = PublicUser & {
    /** Permission keys granted by the user's role, sorted. */
    permissions: PermissionKey[];
};

/**
 * `GET /api/auth/me` — returns the current user with their role's permission
 * keys. Authentication is handled by the app-wide {@link AuthGuard}: it
 * resolves the session cookie, 401s when there is no valid session, and
 * attaches the user, which `@CurrentUser()` reads here. Used by the admin app
 * to decide auth state on load and to gate permissioned UI.
 */
@Controller('auth')
export class MeController {
    constructor(private readonly permissions: PermissionsService) {}

    @Get('me')
    async me(@CurrentUser() user: PublicUser): Promise<CurrentUserView> {
        return {
            ...user,
            permissions: await this.permissions.keysForRole(user.roleId)
        };
    }
}
