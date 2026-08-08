import {
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
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
import { PublicEntryWritesService } from '../../infrastructure/public-entry-writes.service';
import type { EntryLocator } from '../../infrastructure/public-entries.query';
import type { PublicEntry } from '../../types/public-entry';
import { ApiTokenGuard } from '../guards/api-token.guard';
import { ApiTokenWorkspaceGuard } from '../guards/api-token-workspace.guard';
import { PublicSaveEntryDto } from '../dto/public-save-entry.dto';
import { PublicEntryQueryDto } from '../dto/public-list-entries-query.dto';
import { resolveGrantedType } from './resolve-granted-type';

/**
 * `POST|PATCH|DELETE /api/v1/content/...` — the **write half** of the public,
 * token-authenticated content API. A `full`-scope token can author content from
 * outside the admin: create drafts, edit them, assign and unassign relations,
 * add translations, publish, and remove.
 *
 * Every route is gated by its own permission (`content:create` / `update` /
 * `publish` / `delete`), which `ApiTokenGuard` evaluates against the token's
 * scope through the same `AccessPolicy` the session routes use. A `read` token
 * therefore gets a **403** on all of them without a line of code here saying so.
 *
 * Like the reads, every single-entry write exists in **both addressing forms** —
 * `:id` and `group/:localeGroupId` — so a localized client that holds group ids
 * can edit, publish, and delete without ever learning a per-locale id.
 *
 * **No `OriginGuard`**, unlike the admin's write controllers: those are
 * cookie-authenticated and so CSRF-able, while a bearer token is never sent
 * ambiently by a browser. Requiring an `Origin` header here would reject every
 * server-side client instead of protecting anything.
 */
@Public()
@UseGuards(ApiTokenGuard, ApiTokenWorkspaceGuard)
@ApiSecurity('apiToken')
@ApiHeader({
    name: 'X-Workspace-Id',
    required: false,
    description:
        "The workspace to write in. Required when the token covers more than one workspace; optional when it covers exactly one. A workspace outside the token's bucket is a 403."
})
@Controller('v1/content')
export class PublicEntryWritesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly grants: WorkspaceGrantsQuery,
        private readonly writes: PublicEntryWritesService
    ) {}

    /** `POST /api/v1/content/:typeName` — create a draft entry. */
    @Post(':typeName')
    @RequirePermissions(PERMISSIONS.CONTENT_CREATE)
    @ApiOperation({
        summary: 'Create an entry',
        description:
            'Creates the entry as a **draft** on publishable types — publish is a separate call, so a create always has a reviewable state. `values` is validated against the type’s field specs (422 with per-field issues). Pass `localeGroupId` with a different `locale` to add a translation to an existing record. 404 when the type is unknown or the workspace was not granted it.'
    })
    async create(
        @Param('typeName') typeName: string,
        @Body() body: PublicSaveEntryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.writes.create(type, body, workspaceId, granted);
    }

    // ---- addressed by translation group -----------------------------------
    //
    // Declared before the `:id` forms for the same reason as the reads: they
    // cannot collide on segment count, but Express matches in declaration order
    // and literal-prefixed routes belong ahead of wildcards.

    /** `PATCH /api/v1/content/:typeName/group/:localeGroupId` */
    @Patch(':typeName/group/:localeGroupId')
    @RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
    @ApiOperation({
        summary: 'Update the group’s entry for a locale',
        description:
            'As the `:id` form, for the group’s row in the requested `?locale=`.'
    })
    updateByGroup(
        @Param('typeName') typeName: string,
        @Param('localeGroupId', ParseUUIDPipe) localeGroupId: string,
        @Body() body: PublicSaveEntryDto,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        return this.applyUpdate(
            typeName,
            { localeGroupId },
            body,
            workspaceId,
            query.locale
        );
    }

    /** `POST /api/v1/content/:typeName/group/:localeGroupId/publish` */
    @Post(':typeName/group/:localeGroupId/publish')
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    @ApiOperation({ summary: 'Publish the group’s entry for a locale' })
    publishByGroup(
        @Param('typeName') typeName: string,
        @Param('localeGroupId', ParseUUIDPipe) localeGroupId: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        return this.applyPublish(
            typeName,
            { localeGroupId },
            workspaceId,
            query.locale,
            true
        );
    }

    /** `POST /api/v1/content/:typeName/group/:localeGroupId/unpublish` */
    @Post(':typeName/group/:localeGroupId/unpublish')
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    @ApiOperation({ summary: 'Unpublish the group’s entry for a locale' })
    unpublishByGroup(
        @Param('typeName') typeName: string,
        @Param('localeGroupId', ParseUUIDPipe) localeGroupId: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        return this.applyPublish(
            typeName,
            { localeGroupId },
            workspaceId,
            query.locale,
            false
        );
    }

    /** `DELETE /api/v1/content/:typeName/group/:localeGroupId` */
    @Delete(':typeName/group/:localeGroupId')
    @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete the group’s entry for a locale',
        description:
            'Removes **one** translation — the group’s row in the requested `?locale=`. The other locales stay live.'
    })
    removeByGroup(
        @Param('typeName') typeName: string,
        @Param('localeGroupId', ParseUUIDPipe) localeGroupId: string,
        @Query() query: PublicEntryQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<void> {
        return this.applyRemove(
            typeName,
            { localeGroupId },
            workspaceId,
            query.locale
        );
    }

    // ---- addressed by entry id ---------------------------------------------

    /** `PATCH /api/v1/content/:typeName/:id` — replace an entry's values. */
    @Patch(':typeName/:id')
    @RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
    @ApiOperation({
        summary: 'Update an entry',
        description:
            'A **partial** update: the `values` you send are merged over the stored ones, so omitting a field leaves it alone and sending `null` clears it. (The admin’s own PATCH replaces the whole bag — the editor always submits the full document — but an API client sends the two fields it changed, and silently nulling the rest would be invisible until a later publish failed.) `relations` deltas apply in the same transaction. On a publishable type a published entry moves back to **draft** while its published version stays live, so an edit never silently changes what the world is reading — publish again to ship it. 404 when no such entry exists in this workspace.'
    })
    update(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: PublicSaveEntryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        // No locale: an entry id already names exactly one row, in whatever
        // locale it happens to be.
        return this.applyUpdate(typeName, { id }, body, workspaceId, undefined);
    }

    /** `POST /api/v1/content/:typeName/:id/publish` — take an entry live. */
    @Post(':typeName/:id/publish')
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    @ApiOperation({
        summary: 'Publish an entry',
        description:
            'Re-validates the stored row and takes it live. A draft that no longer passes validation is a 422 — `required` means required *to publish*, so an incomplete draft is legal right up until this call. 400 on a type that is not publishable.'
    })
    publish(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        return this.applyPublish(typeName, { id }, workspaceId, undefined, true);
    }

    /** `POST /api/v1/content/:typeName/:id/unpublish` — take it off the air. */
    @Post(':typeName/:id/unpublish')
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    @ApiOperation({
        summary: 'Unpublish an entry',
        description:
            'Reverts the entry to a draft. It leaves the published reads immediately; a write-scoped token can still see it with `?status=draft`.'
    })
    unpublish(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<PublicEntry> {
        return this.applyPublish(
            typeName,
            { id },
            workspaceId,
            undefined,
            false
        );
    }

    /** `DELETE /api/v1/content/:typeName/:id` — remove an entry. */
    @Delete(':typeName/:id')
    @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete an entry',
        description:
            'Soft-deletes on a `paranoid` type (recoverable from the admin’s trash, invisible here either way) and hard-deletes otherwise. Deletes exactly this row: on a localized type the other translations of the group stay live.'
    })
    remove(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<void> {
        return this.applyRemove(typeName, { id }, workspaceId, undefined);
    }

    // ---- the shared handlers, one per write --------------------------------
    //
    // Each is called by both addressing forms, so the pair stays a routing
    // detail and never a behavioural fork — the same arrangement as the reads.

    /** @see update */
    private async applyUpdate(
        typeName: string,
        locator: EntryLocator,
        body: PublicSaveEntryDto,
        workspaceId: string,
        locale: string | undefined
    ): Promise<PublicEntry> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return this.writes.update(
            type,
            locator,
            body,
            workspaceId,
            granted,
            locale
        );
    }

    /** @see publish */
    private async applyPublish(
        typeName: string,
        locator: EntryLocator,
        workspaceId: string,
        locale: string | undefined,
        live: boolean
    ): Promise<PublicEntry> {
        const { type, granted } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        return live
            ? this.writes.publish(type, locator, workspaceId, granted, locale)
            : this.writes.unpublish(
                  type,
                  locator,
                  workspaceId,
                  granted,
                  locale
              );
    }

    /** @see remove */
    private async applyRemove(
        typeName: string,
        locator: EntryLocator,
        workspaceId: string,
        locale: string | undefined
    ): Promise<void> {
        const { type } = await resolveGrantedType(
            this.registry,
            this.grants,
            typeName,
            workspaceId
        );
        await this.writes.remove(type, locator, workspaceId, locale);
    }
}
