import {
    Controller,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    CurrentWorkspace,
    OriginGuard,
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
 * `POST /api/content/:typeName/:id/publish` and `.../unpublish` — the publish
 * workflow for a single entry. Publish revalidates the stored row (a 422 if the
 * draft no longer passes), then stamps `status='published'` + `published_at`;
 * unpublish reverts to draft. Both 400 on a non-publishable type and 404 on a
 * missing live row. `OriginGuard` defends the writes; `WorkspaceGuard` scopes
 * them to a workspace the caller belongs to; `content:publish` gates them.
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
@Controller('content')
export class PublishEntryController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    @Post(':typeName/:id/publish')
    publish(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.writer.publish(type, id, workspaceId);
    }

    @Post(':typeName/:id/unpublish')
    unpublish(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.writer.unpublish(type, id, workspaceId);
    }
}
