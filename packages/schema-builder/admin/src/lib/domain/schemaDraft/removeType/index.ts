import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';

/** Drops a type. Relations that named it are left for the rules to flag. */
export function removeType(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'type.remove' }>
): SchemaDocument {
    return {
        ...doc,
        types: doc.types.filter((type) => type.name !== action.name)
    };
}
