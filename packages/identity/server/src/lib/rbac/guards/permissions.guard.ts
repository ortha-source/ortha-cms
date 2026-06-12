import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/decorators/current-user.decorator';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import type { PermissionKey } from '../system-roles';
import { PermissionsService } from '../services/permissions.service';

/**
 * Enforces `@RequirePermission(…)` against the requesting user's role grants.
 * Runs after the app-wide `AuthGuard` (global guards precede controller-bound
 * ones), so it reads the attached `request.user` and never re-authenticates;
 * a missing user — e.g. the guard was applied to a `@Public()` route — fails
 * closed with a 403, as does any missing grant.
 *
 * Bind it per controller with `@UseGuards(PermissionsGuard)`; it is exported
 * by `@ortha-cms/identity-server` so feature plugins can guard their routes
 * without owning any RBAC machinery.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly permissions: PermissionsService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<
            PermissionKey[] | undefined
        >(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!required || required.length === 0) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        const user = request.user;
        if (!user) {
            throw new ForbiddenException();
        }

        const granted = await this.permissions.keysForRole(user.roleId);
        const allowed = required.every((key) => granted.includes(key));
        if (!allowed) {
            throw new ForbiddenException();
        }
        return true;
    }
}
