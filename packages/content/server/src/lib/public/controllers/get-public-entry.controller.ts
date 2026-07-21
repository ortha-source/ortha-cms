import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Query,
    UseGuards
} from '@nestjs/common';
import {
    ApiTokenGuard,
    PERMISSIONS,
    Public,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace } from '@ortha-cms/workspaces-server';
import { clampInt } from '@ortha-cms/utils-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { EntryWriterService } from '../../entries/infrastructure/persistence/entry-writer.service';
import { RELATION_PAGE_SIZE } from '../../entries/infrastructure/persistence/relation-link.service';
import { MAX_PAGE_SIZE } from '../../entries/entries.constants';
import { resolveType } from '../../entries/http/controllers/resolve-type';
import type {
    EntryRecord,
    EntryRelationsView,
    RelationFieldView
} from '../../entries/types/entry-list-view';

/**
 * `GET /api/v1/content/:typeName/:id[/relations[/:field]]` — the external,
 * bearer-token-authenticated single-entry reads, mirroring the admin's
 * `GetEntryController`. Every route is scoped to the token's workspace
 * (`@CurrentWorkspace()`), so an id outside it reads as 404. Read-only:
 * `content:read`, enforced against the token's scope by {@link ApiTokenGuard}.
 */
@Public()
@UseGuards(ApiTokenGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('v1/content')
export class GetPublicEntryController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    /** One live entry by id (404 if unknown or soft-deleted in the workspace). */
    @Get(':typeName/:id')
    getOne(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.writer.getOne(type, id, workspaceId);
    }

    /** First page of every relation field's links for one entry. */
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

    /** One page of a single relation field's links (`{ items, total }`). */
    @Get(':typeName/:id/relations/:field')
    getRelationField(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('field') field: string,
        @CurrentWorkspace() workspaceId: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string
    ): Promise<RelationFieldView> {
        const type = resolveType(this.registry, typeName);
        return this.writer.getRelationField(
            type,
            id,
            field,
            clampInt(page, 1, 1, Number.MAX_SAFE_INTEGER),
            clampInt(pageSize, RELATION_PAGE_SIZE, 1, MAX_PAGE_SIZE),
            workspaceId
        );
    }
}
