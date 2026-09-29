import {
    CanActivate,
    ExecutionContext,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import { WorkspaceGrantsQuery } from '../../../content-types/queries/workspace-grants.query';
import { isReachable } from '../../../content-types/queries/content-access';
import { SharedOnlyContentTypeException } from '../../../content-types/errors/shared-only-content-type.exception';
import {
    CONTENT_GRANT_ACCESS,
    type ContentGrantAccessMode
} from './content-grant-access.decorator';

/** The route param every registry-driven content route names its type with. */
const TYPE_PARAM = 'typeName';

/**
 * Refuses a content route whose `:typeName` the **open workspace** cannot
 * reach through its grants (`workspace_content`), with the same `404` an
 * unknown type gets — and, since ADR-0019's "Explicit per-source grants",
 * refuses a **write** to a type it can reach but does not own with a `403`.
 *
 * Two grants, two questions:
 *
 * - a route marked `@ContentGrantAccess('read')` needs the type to be
 *   **reachable** — an own grant, or a shared grant whose source is still
 *   shared, active and holding the type;
 * - every other route is a **write** and needs the **own** grant. A reachable
 *   type without one answers {@link SharedOnlyContentTypeException} (403): the
 *   type is visible, so a 404 would contradict the reads beside it.
 *
 * The grant set is the workspace's declared content surface: the nav renders
 * from it, the workspace wizard writes it, and revoking an own grant is
 * refused while entries of that type still exist. Every other surface over
 * this same content honours it — the public REST API (`resolveGrantedType`),
 * the GraphQL adapter, the MCP tools and the copilot's read/propose tools all
 * resolve a type through the grants.
 *
 * **Unknown and unreachable are deliberately indistinguishable** — same
 * status, same message, and the grant read happens before any registry
 * decision — so the route carries no signal about which types exist outside
 * the caller's workspace. That is also why this is a guard rather than a check
 * inside each handler: it runs before the controller can leak a type-shaped
 * error.
 *
 * Must be listed **after** `WorkspaceGuard`, which validates the header and
 * attaches `request.workspaceId`. Applies only to routes carrying a
 * `:typeName` param; a route without one is left alone (there is nothing to
 * scope), which is why the `/api/content-schema` routes keep their own rules.
 */
@Injectable()
export class ContentGrantGuard implements CanActivate {
    constructor(
        private readonly grants: WorkspaceGrantsQuery,
        private readonly reflector: Reflector,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

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
        const mode =
            this.reflector.getAllAndOverride<ContentGrantAccessMode>(
                CONTENT_GRANT_ACCESS,
                [context.getHandler(), context.getClass()]
            ) ?? 'write';
        const access = (await this.grants.access(workspaceId)).get(typeName);
        if (!isReachable(access)) {
            throw new NotFoundException(`Unknown content type "${typeName}".`);
        }
        if (mode === 'write' && !access?.own) {
            const type = this.registry.get(typeName);
            if (!type) {
                throw new NotFoundException(
                    `Unknown content type "${typeName}".`
                );
            }
            throw new SharedOnlyContentTypeException(type);
        }
        return true;
    }
}
