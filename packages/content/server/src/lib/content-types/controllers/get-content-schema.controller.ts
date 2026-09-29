import {
    Controller,
    Get,
    NotFoundException,
    Param,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { WorkspaceGrantsQuery } from '../queries/workspace-grants.query';
import { isReachable } from '../queries/content-access';
import type { ContentTypeWithAccess } from '../content-access.view';

/**
 * `GET /api/content-schema/:name` — the full field schema of one content
 * type: types, validation rules, and admin presentation props. This is
 * what the admin's dynamic tables/forms render from. Authentication is
 * enforced by the app-wide AuthGuard; read access is gated on `content:read`.
 *
 * **Workspace-scoped**, like its `/filter-fields` sibling and unlike the
 * `GET /api/content-schema` catalogue: the schema of a type is the shape of
 * content this workspace may open, so a type the workspace cannot reach — no
 * own grant and no available shared grant (ADR-0019, "Explicit per-source
 * grants") — answers with exactly the `404` an unknown name gets —
 * same status, same message, grants read before the registry decision — and
 * the route therefore discloses nothing about the content model outside the
 * caller's workspace. Serving it unconditionally was the read half of the
 * hole `ContentGrantGuard` closes on the entry routes.
 *
 * Carries the same `access` block as the catalogue's items, so an editor
 * opening a shared-only type knows up front that it can link but not create.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content-schema')
export class GetContentSchemaController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    @Get(':name')
    async get(
        @Param('name') name: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<ContentTypeWithAccess> {
        const serialized = this.registry.serialize(name);
        // Read the grants before deciding, so an unreachable type and an
        // unknown one are indistinguishable — same status, same body, same
        // work done.
        const access = (await this.grants.access(workspaceId)).get(name);
        if (!serialized || !access || !isReachable(access)) {
            throw new NotFoundException(`Unknown content type "${name}".`);
        }
        return { ...serialized, access };
    }
}
