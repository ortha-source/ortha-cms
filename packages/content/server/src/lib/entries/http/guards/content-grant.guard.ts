import {
    CanActivate,
    ExecutionContext,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import type { Request } from 'express';
import { WorkspaceGrantsQuery } from '../../../content-types/queries/workspace-grants.query';

/** The route param every registry-driven content route names its type with. */
const TYPE_PARAM = 'typeName';

/**
 * Refuses a content route whose `:typeName` the **open workspace** was never
 * granted (`workspace_content`), with the same `404` an unknown type gets.
 *
 * The grant set is the workspace's declared content surface: the nav renders
 * from it, the workspace wizard writes it, and revoking a grant is refused
 * while entries of that type still exist. Every other surface over this same
 * content already honours it — the public REST API
 * (`resolveGrantedType`), the GraphQL adapter, the MCP tools and the copilot's
 * read/propose tools all resolve a type through the grants. The session-side
 * admin API was the one exception, so a member of a workspace granted only
 * `article` could still list, read, create, edit, publish and delete `tag`
 * entries in it by naming the type in the URL — rows the admin then never
 * shows (its nav is grant-driven) yet which count toward the workspace-delete
 * guard, and which re-break the "a revoked grant never orphans records"
 * invariant from the other side.
 *
 * **Unknown and ungranted are deliberately indistinguishable** — same status,
 * same message, and the grant read happens before any registry decision — so
 * the route carries no signal about which types exist outside the caller's
 * workspace. That is also why this is a guard rather than a check inside each
 * handler: it runs before the controller can leak a type-shaped error.
 *
 * Must be listed **after** `WorkspaceGuard`, which validates the header and
 * attaches `request.workspaceId`. Applies only to routes carrying a
 * `:typeName` param; a route without one is left alone (there is nothing to
 * scope), which is why the global `/api/content-schema` catalogue keeps its own
 * rules.
 */
@Injectable()
export class ContentGrantGuard implements CanActivate {
    constructor(private readonly grants: WorkspaceGrantsQuery) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<Request & { workspaceId?: string }>();
        const typeName = request.params?.[TYPE_PARAM];
        if (!typeName) return true;
        const workspaceId = request.workspaceId;
        if (!workspaceId) {
            // Only reachable if the guard is wired without `WorkspaceGuard`
            // ahead of it — refuse rather than fall open.
            throw new NotFoundException(`Unknown content type "${typeName}".`);
        }
        const granted = await this.grants.grantedSlugs(workspaceId);
        if (!granted.has(typeName)) {
            throw new NotFoundException(`Unknown content type "${typeName}".`);
        }
        return true;
    }
}
