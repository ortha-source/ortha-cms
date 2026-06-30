import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { EntryWriterService } from '../services/entry-writer.service';
import { SaveEntryDto } from '../dto/save-entry.dto';
import type { EntryRecord } from '../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `POST /api/content/:typeName` — create a draft entry from a validated values
 * bag. The `:typeName` resolves via the registry (404 if unknown); the body is
 * validated against the type's field specs (422 with the issue list on failure).
 * `OriginGuard` defends this state-changing POST (CSRF); `content:create` gates it.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.CONTENT_CREATE)
@Controller('content')
export class CreateEntryController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    @Post(':typeName')
    create(
        @Param('typeName') typeName: string,
        @Body() body: SaveEntryDto
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.writer.create(type, body.values);
    }
}
