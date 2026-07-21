import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
    ApiTokenGuard,
    PERMISSIONS,
    Public,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace } from '@ortha-cms/workspaces-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { EntriesService } from '../../entries/infrastructure/queries/entries.service';
import { ListEntriesQueryDto } from '../../entries/http/dto/list-entries-query.dto';
import { resolveType } from '../../entries/http/controllers/resolve-type';
import type { EntryListView } from '../../entries/types/entry-list-view';

/**
 * `GET /api/v1/content/:typeName` — the external, **bearer-token**-authenticated
 * mirror of the admin's records list. Same generic pipeline
 * (`search`/`filter`/`sort`/pagination + relation filtering), same
 * `{ items, total, page, pageSize }` envelope — the only difference is the
 * caller: an API token instead of a session.
 *
 * `@Public()` opts the route out of the app-wide session `AuthGuard` so
 * {@link ApiTokenGuard} owns authentication; the guard authorizes the token's
 * scope against `content:read` and mirrors the token's workspace onto the
 * request, so `@CurrentWorkspace()` scopes the query exactly as the admin
 * routes do — a token can never read another workspace's entries.
 */
@Public()
@UseGuards(ApiTokenGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('v1/content')
export class ListPublicEntriesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly entries: EntriesService
    ) {}

    @Get(':typeName')
    list(
        @Param('typeName') typeName: string,
        @Query() query: ListEntriesQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryListView> {
        const type = resolveType(this.registry, typeName);
        return this.entries.list(type, query, workspaceId);
    }
}
