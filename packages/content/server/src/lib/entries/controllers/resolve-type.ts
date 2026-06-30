import { NotFoundException } from '@nestjs/common';
import type { AnyContentType } from '../../types/content-type';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';

/**
 * Resolve a `:typeName` route param to a registered content type, or throw 404.
 * Every entries controller routes one path per HTTP verb against the registry,
 * so this single lookup keeps them thin and consistent.
 */
export function resolveType(
    registry: ContentTypeRegistry,
    typeName: string
): AnyContentType {
    const type = registry.get(typeName);
    if (!type) {
        throw new NotFoundException(`Unknown content type "${typeName}".`);
    }
    return type;
}
