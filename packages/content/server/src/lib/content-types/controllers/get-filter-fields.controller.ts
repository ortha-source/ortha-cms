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
} from '@ortha-cms/identity-server';
import {
    CurrentWorkspace,
    WorkspaceGuard
} from '@ortha-cms/workspaces-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { buildEntryFilterSurface } from '../../entries/infrastructure/queries/entry-filter-surface';
import type { FilterFieldsResponse } from '../../entries/types/filter-surface';

/**
 * `GET /api/content-schema/:name/filter-fields` — every scalar path the
 * records-table query builder may filter on: the type's own fields plus,
 * recursively within the relation-hop budget, its relations' fields
 * (`author.name`, `author.company.name`). This is the admin counterpart of
 * the SQL `FilterSchema` the list endpoint enforces — both come from a
 * single `buildEntryFilterSurface` traversal, so the picker can never offer
 * a path the API would reject with a 400.
 *
 * Workspace-scoped (unlike the sibling `/content-schema` routes): the
 * response is inherently per-workspace once grant pruning is applied, and
 * `WorkspaceGuard` supplies the id. Grant pruning of the offered relations
 * (mirroring the entry editor's `availableTypeNames`) is not yet wired —
 * content-server holds no port into the `workspace_content` grants — so v1
 * offers every defined relation; the picker's own search absorbs the noise,
 * and the SQL is workspace-scoped regardless. Passing `grantedTypes` to the
 * builder is the one change that closes it.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content-schema')
export class GetFilterFieldsController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    @Get(':name/filter-fields')
    filterFields(
        @Param('name') name: string,
        @CurrentWorkspace() workspaceId: string
    ): FilterFieldsResponse {
        const type = this.registry.get(name);
        if (!type) {
            throw new NotFoundException(`Unknown content type "${name}".`);
        }
        const { fields } = buildEntryFilterSurface(type, { workspaceId });
        return { fields };
    }
}
