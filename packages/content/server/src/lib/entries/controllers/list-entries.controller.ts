import {
    Controller,
    Get,
    NotFoundException,
    Param,
    Query,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { EntriesService } from '../services/entries.service';
import { ListEntriesQueryDto } from '../dto/list-entries-query.dto';
import type { EntryListView } from '../types/entry-list-view';

/**
 * `GET /api/content/:typeName` — one page of a collection's entries, filtered/
 * searched/sorted via query params (`?search=`, `?filter=`, `?sort=`, `?page=`,
 * `?pageSize=`). The `:typeName` is resolved from the registry (404 if unknown),
 * so this single route serves every collection; the service runs the generic SQL
 * pipeline against the type's generated table. Authentication is enforced by the
 * app-wide AuthGuard; read access is gated on `content:read`.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content')
export class ListEntriesController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly entries: EntriesService
    ) {}

    @Get(':typeName')
    list(
        @Param('typeName') typeName: string,
        @Query() query: ListEntriesQueryDto
    ): Promise<EntryListView> {
        const type = this.registry.get(typeName);
        if (!type) {
            throw new NotFoundException(`Unknown content type "${typeName}".`);
        }
        return this.entries.list(type, query);
    }
}
