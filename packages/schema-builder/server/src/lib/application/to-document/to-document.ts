import type { AnyContentType } from '@orthacms/content-server';
import {
    SCHEMA_DOCUMENT_VERSION,
    type SchemaDocument,
    type TypeOrigin
} from '@orthacms/schema-builder-domain';
import { toTypeDoc } from './to-type-doc';

/** Every registered type as one document, in registration order. */
export async function toDocument(
    types: readonly AnyContentType[],
    originOf: (type: AnyContentType) => Promise<TypeOrigin>
): Promise<SchemaDocument> {
    const docs = await Promise.all(
        types.map(async (type) => toTypeDoc(type, await originOf(type)))
    );
    return { version: SCHEMA_DOCUMENT_VERSION, types: docs };
}
