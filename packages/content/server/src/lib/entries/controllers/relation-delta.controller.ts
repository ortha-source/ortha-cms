import {
    Body,
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
import { RelationDeltaDto } from '../dto/relation-delta.dto';
import type { RelationFieldView } from '../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `POST /api/content/:typeName/:id/relations/:field` — apply an incremental
 * link / unlink / reorder to one many/inverse relation field, returning the
 * field's refreshed first page. The **incremental** counterpart to editing a
 * relation through the entry body: the client sends only the diff, so a relation
 * with thousands of links is never sent (or held) in full, and the change
 * commits in one transaction. 400 on a single relation (edit it via the entry's
 * `values`) or an unknown field; 404 if the entry is missing. `OriginGuard`
 * defends the write; `WorkspaceGuard` scopes it; `content:update` gates it.
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
@Controller('content')
export class RelationDeltaController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    @Post(':typeName/:id/relations/:field')
    apply(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('field') field: string,
        @Body() body: RelationDeltaDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<RelationFieldView> {
        const type = resolveType(this.registry, typeName);
        return this.writer.applyRelationDelta(
            type,
            id,
            field,
            body,
            workspaceId
        );
    }
}
