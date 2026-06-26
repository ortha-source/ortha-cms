import {
    Body,
    Controller,
    Param,
    ParseUUIDPipe,
    Patch,
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
import { SaveEntryDto } from '../dto/save-entry.dto';
import type { EntryRecord } from '../types/entry-list-view';
import { resolveType } from './resolve-type';

/**
 * `PATCH /api/content/:typeName/:id` — replace a live entry's values with a
 * validated bag (the editor always submits the full document). 404 if there's no
 * live row; 422 with the issue list on validation failure. `OriginGuard` defends
 * this state-changing write; `content:update` gates it.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
@Controller('content')
export class UpdateEntryController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService
    ) {}

    @Patch(':typeName/:id')
    update(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: SaveEntryDto
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.writer.update(type, id, body.values);
    }
}
