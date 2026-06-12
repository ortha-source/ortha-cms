import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { PublicUser } from '../services/auth.service';
import { PermissionsService } from '../../rbac/services/permissions.service';
import type { PermissionKey } from '../../rbac/system-roles';

/** The current user plus the permission keys their role grants. */
export type MeResponse = PublicUser & { permissions: PermissionKey[] };

/**
 * `GET /api/auth/me` — returns the current user and the permissions their role
 * grants. Authentication is handled by the app-wide {@link AuthGuard}: it
 * resolves the session cookie, 401s when there is no valid session, and attaches
 * the user, which `@CurrentUser()` reads here. The admin uses the user to decide
 * auth state on load and the permissions to gate UI (e.g. the create button).
 */
@Controller('auth')
export class MeController {
    constructor(private readonly permissions: PermissionsService) {}

    @Get('me')
    async me(@CurrentUser() user: PublicUser): Promise<MeResponse> {
        const permissions = await this.permissions.forRole(user.roleId);
        return { ...user, permissions };
    }
}
