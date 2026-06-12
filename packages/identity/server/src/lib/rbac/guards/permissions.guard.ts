import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/decorators/current-user.decorator';
import type { PermissionKey } from '../system-roles';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionsService } from '../services/permissions.service';

/**
 * Enforces `@RequirePermissions(...)`. Runs after the global `AuthGuard` (which
 * attaches the user), resolves the user's role grants, and 403s unless every
 * required permission is held. Routes without the decorator pass through.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly permissions: PermissionsService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<PermissionKey[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()]
        );
        if (!required || required.length === 0) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        const user = request.user;
        // The global AuthGuard runs first and attaches the user; a missing user
        // means the route wasn't authenticated — deny rather than crash.
        if (!user) {
            throw new ForbiddenException();
        }

        const held = new Set(await this.permissions.forRole(user.roleId));
        const allowed = required.every((permission) => held.has(permission));
        if (!allowed) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return true;
    }
}
