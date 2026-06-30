import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { EntryWriterService } from '../services/entry-writer.service';
import { BulkIdsDto } from '../dto/bulk-ids.dto';
import type {
    BulkActionResult,
    BulkPublishPreview,
    BulkPublishResult
} from '../types/bulk-publish';
import { resolveType } from './resolve-type';

/**
 * Bulk entry actions over a set of `{ ids }`. **Registered before the
 * single-item controllers** (see `content.module.ts`): the literal `bulk`
 * segment sits in the same slot as those controllers' `:id`, so it must match
 * first — otherwise `/bulk/publish` would resolve as `:id='bulk'` (and trip the
 * single-item `ParseUUIDPipe`). Per-route permissions: publish/unpublish need
 * `content:publish`, delete/restore need `content:delete`.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@Controller('content')
export class BulkEntriesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    /** Dry run: validate each id and report a per-entry verdict. Writes nothing. */
    @Post(':typeName/bulk/publish/preview')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    previewPublish(
        @Param('typeName') typeName: string,
        @Body() body: BulkIdsDto
    ): Promise<BulkPublishPreview> {
        const type = resolveType(this.registry, typeName);
        return this.writer.previewBulkPublish(type, body.ids);
    }

    @Post(':typeName/bulk/publish')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    publish(
        @Param('typeName') typeName: string,
        @Body() body: BulkIdsDto
    ): Promise<BulkPublishResult> {
        const type = resolveType(this.registry, typeName);
        return this.writer.bulkPublish(type, body.ids);
    }

    @Post(':typeName/bulk/unpublish')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions(PERMISSIONS.CONTENT_PUBLISH)
    unpublish(
        @Param('typeName') typeName: string,
        @Body() body: BulkIdsDto
    ): Promise<BulkActionResult> {
        const type = resolveType(this.registry, typeName);
        return this.writer.bulkUnpublish(type, body.ids);
    }

    @Post(':typeName/bulk/delete')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
    remove(
        @Param('typeName') typeName: string,
        @Body() body: BulkIdsDto
    ): Promise<BulkActionResult> {
        const type = resolveType(this.registry, typeName);
        return this.writer.bulkRemove(type, body.ids);
    }

    @Post(':typeName/bulk/restore')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
    restore(
        @Param('typeName') typeName: string,
        @Body() body: BulkIdsDto
    ): Promise<BulkActionResult> {
        const type = resolveType(this.registry, typeName);
        return this.writer.bulkRestore(type, body.ids);
    }

    @Post(':typeName/bulk/purge')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
    purge(
        @Param('typeName') typeName: string,
        @Body() body: BulkIdsDto
    ): Promise<BulkActionResult> {
        const type = resolveType(this.registry, typeName);
        return this.writer.bulkPurge(type, body.ids);
    }
}
