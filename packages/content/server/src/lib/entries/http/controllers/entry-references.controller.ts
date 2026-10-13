import {
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import { ContentGrantGuard } from '../guards/content-grant.guard';
import { ContentGrantAccess } from '../guards/content-grant-access.decorator';
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import { EntryReferencesQuery } from '../../infrastructure/queries/entry-references.query';
import type { EntryReferencesView } from '../../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `GET /api/content/:typeName/:id/references` — which records in **this**
 * workspace link to the entry, per referring field, and what deleting it for
 * good would do to them (`onPurge`). The admin asks it before a delete or a
 * purge, so the confirmation can say "12 records link here, 3 of them live" —
 * a delete used to go through with no word about what pointed at it.
 *
 * The entry may be live **or in the trash** — a purge is confirmed from the
 * trash. A missing or foreign id is a 404, as on every sibling read. Counts
 * only, never the linking entries. `content:read`, behind `WorkspaceGuard` +
 * `ContentGrantGuard` like the rest.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard, ContentGrantGuard)
@ContentGrantAccess('read')
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content')
export class EntryReferencesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly references: EntryReferencesQuery
    ) {}

    @Get(':typeName/:id/references')
    async referencesOf(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryReferencesView> {
        const type = resolveType(this.registry, typeName);
        if (!(await this.references.exists(type, id, workspaceId))) {
            throw new NotFoundException(
                `No "${type.name}" entry "${id}" in this workspace.`
            );
        }
        return this.references.forEntry(type, id, workspaceId);
    }
}
