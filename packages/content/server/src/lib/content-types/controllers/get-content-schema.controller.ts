import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectContentRegistry } from '../../content.tokens';
import type {
    ContentTypeRegistry,
    SerializedContentType
} from '../../registry/content-type-registry';

/**
 * `GET /api/content-schema/:name` — the full field schema of one content
 * type: types, validation rules, and admin presentation props. This is
 * what the admin's dynamic tables/forms render from. Authentication is
 * enforced by the app-wide AuthGuard.
 */
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
