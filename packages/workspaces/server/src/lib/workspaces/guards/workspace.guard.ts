import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import type { AuthenticatedRequest } from '@ortha-cms/identity-server';
import { MembershipService } from '../services/membership.service';

/** The header the admin sends to name the workspace a request is scoped to. */
export const WORKSPACE_HEADER = 'x-workspace-id';

/** RFC 4122 UUID shape — the workspace id format the schema stores. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Authorizes a workspace-scoped request. Reads the `X-Workspace-Id` header,
 * rejects a missing/malformed id with 400, and 403s unless the authenticated
 * user is a member of that workspace — the link checked by
 * {@link MembershipService.isMember}. On success it attaches the validated id as
 * `request.workspaceId` for `@CurrentWorkspace()` to read.
 *
 * Runs after the app-wide `AuthGuard` (which has already attached `request.user`
 * or 401'd), so a missing user here is a wiring bug, not an unauthenticated
 * caller. Apply it on every route that reads or writes workspace-owned data so a
 * valid session for workspace A can never touch workspace B's content.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
    constructor(private readonly members: MembershipService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        const user = request.user;
        if (!user) {
            // AuthGuard runs first as the global guard; reaching here without a
            // user means this route was wrongly opted out of authentication.
            throw new UnauthorizedException();
        }

        const header = request.headers[WORKSPACE_HEADER];
        const workspaceId = Array.isArray(header) ? header[0] : header;
        if (!workspaceId || !UUID_RE.test(workspaceId)) {
            throw new BadRequestException(
                'Missing or malformed X-Workspace-Id header.'
            );
        }

        if (!(await this.members.isMember(user.id, workspaceId))) {
            // Don't distinguish "not a member" from "no such workspace" — both
            // are a flat 403 so a non-member can't probe which ids exist.
            throw new ForbiddenException(
                'You are not a member of this workspace.'
            );
        }

        request.workspaceId = workspaceId;
        return true;
    }
}
