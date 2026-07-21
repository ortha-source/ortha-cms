import {
    Controller,
    Get,
    NotFoundException,
    Param,
    UseGuards
} from '@nestjs/common';
import {
    ApiTokenGuard,
    PERMISSIONS,
    Public,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type {
    ContentTypeRegistry,
    SerializedContentType,
    SerializedContentTypeSummary
} from '../../registry/content-type-registry';

/**
 * `GET /api/v1/content-schema[/:name]` — schema discovery for the external API,
 * so a developer can enumerate the available content types (collections +
 * pages) and read one type's full field list before querying it. Same registry
 * projection the admin schema routes serve, behind the bearer-token guard on
 * `content:read`. Schema is not workspace-specific — the types are code-defined
 * — but access still requires a valid token.
 */
@Public()
@UseGuards(ApiTokenGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('v1/content-schema')
export class PublicSchemaController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /** Summaries of every content type. */
    @Get()
    list(): SerializedContentTypeSummary[] {
        return this.registry.summaries();
    }

    /** One type's full field schema (404 if unknown). */
    @Get(':name')
    get(@Param('name') name: string): SerializedContentType {
        const serialized = this.registry.serialize(name);
        if (!serialized) {
            throw new NotFoundException(`Unknown content type "${name}".`);
        }
        return serialized;
    }
}
