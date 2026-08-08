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
import type {
    PublicMediaFieldView,
    PublicRelationFieldView
} from '../../types/public-expansion';
import { RELATION_PAGE_SIZE } from '../../../entries/infrastructure/persistence/relation-link.service';
import { ApiTokenGuard } from '../guards/api-token.guard';
import { ApiTokenWorkspaceGuard } from '../guards/api-token-workspace.guard';
import {
    PublicEntryQueryDto,
    PublicListEntriesQueryDto
} from '../dto/public-list-entries-query.dto';
import { resolveGrantedType } from './resolve-granted-type';

/** One entry's relation links, keyed by field name. */
export interface PublicEntryRelationsView {
    relations: Record<string, PublicRelationFieldView>;
}

/** One entry's media assets, keyed by field name. */
export interface PublicEntryMediaView {
    media: Record<string, PublicMediaFieldView>;
}

/** One entry's sibling translations. */
export interface PublicEntryTranslationsView {
    translations: PublicEntry[];
}

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
 * rows, and `values` carries the entry's own data only (no relation or media
 * fields, in either direction). See {@link PublicEntriesQuery} for the exact
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
            'One page of the type’s published, non-deleted entries in the requested workspace, newest-updated first by default. Supports free-text `?search=` and the structured `?filter=` tree (the same shape the admin query builder emits). 404 when the type is unknown or the workspace was not granted it.'
    })
    async list(
        @Param('typeName') typeName: string,
        @Query() query: PublicListEntriesQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntryListView> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.entries.list(type, query, workspaceId, granted);
    }

    /**
     * `GET /api/v1/content/:typeName/group/:localeGroupId` — one published
     * entry addressed by its translation group and the requested locale.
     *
     * Declared **before** `:typeName/:id` so the literal `group` segment is not
     * a concern either way: that route is two segments and this one is three,
     * so they cannot collide. The ordering is kept for readability and to stay
     * safe if a three-segment wildcard route is ever added below.
     */
    @Get(':typeName/group/:localeGroupId')
    @ApiOperation({
        summary: 'Read one published entry by translation group + locale',
        description:
            'The group’s published row in the requested `?locale=` (the default locale when none is given) — so a localized front-end renders “this story” by varying the locale alone, instead of keeping a per-locale id map. 404 when the group has no published row in that locale, or does not exist. 400 when the type is not localized.'
    })
    async getByLocaleGroup(
        @Param('typeName') typeName: string,
        @Param('localeGroupId', ParseUUIDPipe) localeGroupId: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.entries.getByLocaleGroup(
            type,
            localeGroupId,
            workspaceId,
            query,
            granted
        );
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
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.entries.getOne(type, id, workspaceId, query, granted);
    }

    /**
     * `GET /api/v1/content/:typeName/:id/relations` — every relation field of
     * one entry, first page each. The sibling of the list's `?relations=preview`
     * for a consumer that already has the entry, and — with the per-field route
     * below — the way past the preview's cap.
     */
    @Get(':typeName/:id/relations')
    @ApiOperation({
        summary: 'Read one entry’s relation links',
        description:
            'Every relation field of the entry, keyed by field name, each with one capped page of links plus the count of visible ones. Only published targets are shown or counted; a field whose target type the workspace was not granted is omitted.'
    })
    async getRelations(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntryRelationsView> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return {
            relations: await this.entries.relationsOf(
                type,
                id,
                workspaceId,
                granted,
                query.locale,
                query.relationLimit
            )
        };
    }

    /**
     * `GET /api/v1/content/:typeName/:id/relations/:field` — one page of a
     * single relation field's links, for paging past the preview cap.
     */
    @Get(':typeName/:id/relations/:field')
    @ApiOperation({
        summary: 'Page one relation field’s links',
        description:
            'One ordered page of a single relation field’s visible links. 400 when the field is not a relation, or its target type is not granted to the workspace.'
    })
    async getRelationField(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('field') field: string,
        @Query() query: PublicListEntriesQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicRelationFieldView> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.entries.relationField(
            type,
            id,
            field,
            query.page ?? 1,
            query.pageSize ?? query.relationLimit ?? RELATION_PAGE_SIZE,
            workspaceId,
            granted,
            query.locale
        );
    }

    /**
     * `GET /api/v1/content/:typeName/:id/translations` — the entry's other
     * locale rows. The sibling of `?translations=preview`, for a consumer that
     * already holds the entry.
     */
    @Get(':typeName/:id/translations')
    @ApiOperation({
        summary: 'Read one entry’s sibling translations',
        description:
            'The entry’s other published locale rows — the rest of its translation group — ordered by locale slug, each a full entry honouring the same `?fields=` selection. The entry itself is not repeated. 400 when the type is not localized.'
    })
    async getTranslations(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntryTranslationsView> {
        const { type } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return {
            translations: await this.entries.translationsOf(
                type,
                id,
                workspaceId,
                query
            )
        };
    }

    /**
     * `GET /api/v1/content/:typeName/:id/media` — every media field of one
     * entry, resolved to asset metadata and URLs.
     */
    @Get(':typeName/:id/media')
    @ApiOperation({
        summary: 'Read one entry’s media assets',
        description:
            'Every media field of the entry, keyed by field name, resolved to asset metadata (name, kind, MIME type, alt) and URLs. The URLs are the CMS media routes, which require an authenticated session — a bearer token cannot fetch them.'
    })
    async getMedia(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntryMediaView> {
        const { type } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return {
            media: await this.entries.mediaOf(
                type,
                id,
                workspaceId,
                query.locale,
                query.mediaLimit
            )
        };
    }
}
