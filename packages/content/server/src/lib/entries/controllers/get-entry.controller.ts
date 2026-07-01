import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    CurrentWorkspace,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    WorkspaceGuard
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { EntryWriterService } from '../services/entry-writer.service';
import type {
    EntryRecord,
    EntryRelationsView
} from '../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `GET /api/content/:typeName/:id` — one live entry by id (404 if unknown or
 * soft-deleted), so the editor can open an entry by deep link without relying on
 * the records-list cache. `WorkspaceGuard` scopes it to a workspace the caller
 * belongs to; gated on `content:read`.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content')
export class GetEntryController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    @Get(':typeName/:id')
    getOne(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.writer.getOne(type, id, workspaceId);
    }

    /**
     * `GET /api/content/:typeName/:id/relations` — one entry's relation links,
     * keyed by field name. Every relation field (owning single/many **and**
     * inverse back-references) resolved to display-ready refs (id + title) in a
     * bounded set of queries, so the editor can render assigned relations by
     * title and seed the form value with their ids without a round-trip per
     * link. 404 when the entry is missing or soft-deleted in this workspace.
     */
    @Get(':typeName/:id/relations')
    async getRelations(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryRelationsView> {
        const type = resolveType(this.registry, typeName);
        return {
            relations: await this.writer.getRelations(type, id, workspaceId)
        };
    }
}
