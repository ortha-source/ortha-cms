import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectViewContentRegistry } from '../views.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { WorkspaceGrantsQuery } from '../../content-types/queries/workspace-grants.query';
import { CONTENT_SCOPE_PREFIX } from '../views.constants';

/**
 * Resolves a view's `scope` to a content type the open workspace may actually
 * reach.
 *
 * Without this the views endpoint would be a way around
 * {@link ContentGrantGuard}: `scope` names a content type, and an unchecked one
 * lets a caller confirm that `content:salaries` exists in some workspace by
 * saving a view over it. So the answer for an unknown type and for an ungranted
 * one is the **same 404** the entries routes give — grants read before any
 * registry decision, same status, same message.
 */
@Injectable()
export class ViewScopeService {
    constructor(
        @InjectViewContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    /**
     * Throws `NotFoundException` unless `scope` names a content type this
     * workspace was granted. The DTO has already enforced the
     * `content:<typeName>` shape.
     */
    async assertReachable(scope: string, workspaceId: string): Promise<void> {
        const typeName = scope.slice(CONTENT_SCOPE_PREFIX.length);
        const granted = await this.grants.grantedSlugs(workspaceId);
        if (!granted.has(typeName) || !this.registry.get(typeName)) {
            throw new NotFoundException(`Unknown content type "${typeName}".`);
        }
    }
}
