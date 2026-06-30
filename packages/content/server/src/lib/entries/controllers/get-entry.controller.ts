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
import type { EntryRecord } from '../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `GET /api/content/:typeName/:id` — one live entry by id (404 if unknown or
 * soft-deleted), so the editor can open an entry by deep link without relying on
 * the records-list cache. `WorkspaceGuard` scopes it to a workspace the caller
 * belongs to; gated on `content:read`.
 */
@UseGuards(WorkspaceGuard, PermissionsGuard)
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
}
