import {
    Controller,
    Get,
    NotFoundException,
    Param,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type {
    ContentTypeRegistry,
    SerializedContentType
} from '../../registry/content-type-registry';

/**
 * `GET /api/content-schema/:name` — the full field schema of one content
 * type: types, validation rules, and admin presentation props. This is
 * what the admin's dynamic tables/forms render from. Authentication is
 * enforced by the app-wide AuthGuard; read access is gated on `content:read`.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content-schema')
export class GetContentSchemaController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    @Get(':name')
    get(@Param('name') name: string): SerializedContentType {
        const serialized = this.registry.serialize(name);
        if (!serialized) {
            throw new NotFoundException(`Unknown content type "${name}".`);
        }
        return serialized;
    }
}
