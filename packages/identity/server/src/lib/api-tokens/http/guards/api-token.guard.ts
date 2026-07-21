import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessPolicy, type Actor } from '../../../domain/access-policy';
import { Permission } from '../../../domain/value-objects/permission';
import type { PermissionKey } from '../../../rbac/system-roles';
import { PERMISSIONS_KEY } from '../../../rbac/decorators/require-permissions.decorator';
import { ApiTokenService } from '../../application/api-token.service';
import { scopePermissions } from '../../domain/api-token-scope';
import type { ApiTokenRequest } from '../decorators/current-api-token.decorator';

/**
 * Authenticates the external content API from an `Authorization: Bearer <token>`
 * header and authorizes it against the token's scope. The token's own
 * `workspaceId` becomes the request's scope (mirrored onto `request.workspaceId`
 * for `@CurrentWorkspace()`), so — unlike the session `WorkspaceGuard` — there
 * is no membership lookup: the token *is* the grant to exactly one workspace.
 *
 * A missing/malformed header, or an unknown/revoked/expired token, is a flat
 * 401 (no signal distinguishing them). `@RequirePermissions(...)` on the route
 * is then enforced by turning the token's scope into a permission set and
 * delegating to the same {@link AccessPolicy} the session `PermissionsGuard`
 * uses — so `read` tokens are refused write routes with a 403.
 *
 * Pair it with `@Public()` so the app-wide session `AuthGuard` steps aside and
 * this guard owns authentication for the route.
 */
@Injectable()
export class ApiTokenGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly tokens: ApiTokenService,
        private readonly accessPolicy: AccessPolicy
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<ApiTokenRequest>();

        const secret = bearerToken(request.headers['authorization']);
        if (!secret) {
            throw new UnauthorizedException();
        }

        const token = await this.tokens.verify(secret);
        if (!token) {
            throw new UnauthorizedException();
        }

        const granted = new Set<string>(scopePermissions(token.scope));
        const required = this.reflector.getAllAndOverride<PermissionKey[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()]
        );
        if (required && required.length > 0) {
            const actor: Actor = {
                userId: token.id,
                grantedPermissions: granted
            };
            const allowed = this.accessPolicy.canAll(
                actor,
                required.map((key) => Permission.create(key))
            );
            if (!allowed) {
                throw new ForbiddenException('Insufficient token scope');
            }
        }

        request.apiToken = {
            id: token.id,
            workspaceId: token.workspaceId,
            scope: token.scope
        };
        request.workspaceId = token.workspaceId;
        return true;
    }
}

/**
 * Extracts the raw token from an `Authorization` header, accepting only the
 * `Bearer <token>` scheme (case-insensitive). Returns `null` for anything else.
 */
function bearerToken(header: string | undefined): string | null {
    if (!header) {
        return null;
    }
    const [scheme, value] = header.split(' ');
    if (!value || scheme.toLowerCase() !== 'bearer') {
        return null;
    }
    const token = value.trim();
    return token.length > 0 ? token : null;
}
