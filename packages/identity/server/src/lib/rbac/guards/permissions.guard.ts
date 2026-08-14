import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/decorators/current-user.decorator';
import { AccessPolicy, type Actor } from '../../domain/access-policy';
import { Permission } from '../../domain/value-objects/permission';
import type { PermissionKey } from '../system-roles';
import {
    ANY_PERMISSION_KEY,
    PERMISSIONS_KEY
} from '../decorators/require-permissions.decorator';
import { PermissionsService } from '../services/permissions.service';

/**
 * Enforces `@RequirePermissions(...)`. Runs after the global `AuthGuard` (which
 * attaches the user), resolves the user's role grants, and 403s unless every
 * `@RequirePermissions` permission is held **and** at least one
 * `@RequireAnyPermission` permission is. Routes carrying neither decorator pass
 * through.
 *
 * The permission-set membership decision is delegated to {@link AccessPolicy}
 * (the pure, unit-tested RBAC rule); this guard only wires the request to it —
 * its public contract (a `canActivate` returning `true` / throwing 403) is
 * unchanged.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly permissions: PermissionsService,
        private readonly accessPolicy: AccessPolicy
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<PermissionKey[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()]
        );
        const anyOf = this.reflector.getAllAndOverride<PermissionKey[]>(
            ANY_PERMISSION_KEY,
            [context.getHandler(), context.getClass()]
        );
        const hasAllOf = !!required && required.length > 0;
        const hasAnyOf = !!anyOf && anyOf.length > 0;
        if (!hasAllOf && !hasAnyOf) {
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

        const actor: Actor = {
            userId: user.id,
            grantedPermissions: new Set(
                await this.permissions.forRole(user.roleId)
            )
        };
        const allowed =
            (!hasAllOf ||
                this.accessPolicy.canAll(
                    actor,
                    required.map((key) => Permission.create(key))
                )) &&
            (!hasAnyOf ||
                this.accessPolicy.canAny(
                    actor,
                    anyOf.map((key) => Permission.create(key))
                ));
        if (!allowed) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return true;
    }
}
