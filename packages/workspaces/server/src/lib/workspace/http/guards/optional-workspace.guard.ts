import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '@orthacms/identity-server';
import { MembershipCheckQuery } from '../../infrastructure/queries/membership-check.query';
import { authorizeWorkspaceAccess } from './workspace-access';
import { WORKSPACE_HEADER } from './workspace.guard';

/**
 * {@link WorkspaceGuard} for a route that is **global** but can say more when
 * a workspace is open — e.g. content's `GET /content-schema` catalogue, which
 * adds each type's per-workspace `access` when the admin sends
 * `X-Workspace-Id`.
 *
 * Without the header the request passes untouched and `request.workspaceId`
 * stays unset. With it, the header is held to exactly the rule
 * `WorkspaceGuard` applies ({@link authorizeWorkspaceAccess}): a malformed id
 * is a 400 and a non-member a flat 403 — an optional header must never become
 * a way to probe a workspace the caller does not belong to.
 */
@Injectable()
export class OptionalWorkspaceGuard implements CanActivate {
    constructor(private readonly members: MembershipCheckQuery) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        const header = request.headers[WORKSPACE_HEADER];
        const value = Array.isArray(header) ? header[0] : header;
        if (value === undefined) return true;
        await authorizeWorkspaceAccess(
            this.members,
            request,
            value,
            'Malformed X-Workspace-Id header.'
        );
        return true;
    }
}
