import {
    Controller,
    Get,
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
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import { EntryWriterService } from '../../infrastructure/persistence/entry-writer.service';
import { EntryUsagesQuery } from '../../infrastructure/queries/entry-usages.query';
import type { EntryUsagesView } from '../../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `GET /api/content/:typeName/:id/usages` — how many relation links point at
 * this entry from entries in **other** workspaces, grouped by workspace and
 * sorted by count descending (ADR-0019). What a shared workspace's editor needs
 * before unpublishing or deleting a record others rely on. `{ items: [] }` when
 * nothing links to it.
 *
 * The entry must belong to the current workspace: a foreign (shared) entry,
 * like a missing one, is a 404 — a consumer has no business learning who else
 * consumes it. Reports counts and workspace names only, never the linking
 * entries. `content:read`, behind `WorkspaceGuard` + `ContentGrantGuard` like
 * every sibling read.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard, ContentGrantGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content')
export class EntryUsagesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService,
        private readonly usages: EntryUsagesQuery
    ) {}

    @Get(':typeName/:id/usages')
    async usagesOf(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryUsagesView> {
        const type = resolveType(this.registry, typeName);
        // Own-workspace only: 404s a missing, soft-deleted or foreign entry.
        await this.writer.getOne(type, id, workspaceId);
        return { items: await this.usages.forEntry(type, id, workspaceId) };
    }
}
