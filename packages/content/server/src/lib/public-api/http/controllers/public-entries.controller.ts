import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import {
    PERMISSIONS,
    Public,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace } from '@ortha-cms/workspaces-server';
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import { WorkspaceGrantsQuery } from '../../../content-types/queries/workspace-grants.query';
import { PublicEntriesQuery } from '../../infrastructure/public-entries.query';
import type {
    PublicEntry,
    PublicEntryListView
} from '../../types/public-entry';
import { ApiTokenGuard } from '../guards/api-token.guard';
import { ApiTokenWorkspaceGuard } from '../guards/api-token-workspace.guard';
import {
    PublicEntryQueryDto,
    PublicListEntriesQueryDto
} from '../dto/public-list-entries-query.dto';
import { resolveGrantedType } from './resolve-granted-type';

/**
 * `GET /api/v1/content/...` — the **public, token-authenticated read API** an
 * external site or app fetches content with. One route pair serves every
 * code-defined type: `:typeName` is resolved against the registry (and the
 * workspace's grants) at request time.
 *
 * `@Public()` opts these routes out of the session `AuthGuard`; `ApiTokenGuard`
 * then authenticates the `Authorization: Bearer` token and checks
 * `content:read` against its scope, and `ApiTokenWorkspaceGuard` resolves which
 * of the token's workspaces the request targets (the `X-Workspace-Id` header,
 * or the only one when the token covers a single workspace).
 *
 * Reads are flat and live-only — published entries, no drafts, no soft-deleted
 * rows, no relation expansion. See {@link PublicEntriesQuery} for the exact
 * visibility rule and `types/public-entry.ts` for the wire shape.
 *
 * A `single` (page) type is served by the same list route as a collection: with
 * localization a single still has one row per locale, so a list envelope is the
 * honest shape for both — take `items[0]`.
 */
@Public()
@UseGuards(ApiTokenGuard, ApiTokenWorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@ApiSecurity('apiToken')
@ApiHeader({
    name: 'X-Workspace-Id',
    required: false,
    description:
        "The workspace to read from. Required when the token covers more than one workspace; optional (and ignored) when it covers exactly one. A workspace outside the token's bucket is a 403."
})
@Controller('v1/content')
export class PublicEntriesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly grants: WorkspaceGrantsQuery,
        private readonly entries: PublicEntriesQuery
    ) {}

    /** `GET /api/v1/content/:typeName` — one page of published entries. */
    @Get(':typeName')
    @ApiOperation({
        summary: 'List published entries of a content type',
        description:
            'One page of the type’s published, non-deleted entries in the requested workspace, newest-updated first by default. 404 when the type is unknown or the workspace was not granted it.'
    })
    async list(
        @Param('typeName') typeName: string,
        @Query() query: PublicListEntriesQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntryListView> {
        const type = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.entries.list(type, query, workspaceId);
    }

    /** `GET /api/v1/content/:typeName/:id` — one published entry. */
    @Get(':typeName/:id')
    @ApiOperation({
        summary: 'Read one published entry',
        description:
            'A single published, non-deleted entry of the type. A draft, a soft-deleted entry, one in another workspace, and an unknown id are all the same 404.'
    })
    async getOne(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        const type = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.entries.getOne(type, id, workspaceId, query.locale);
    }
}
