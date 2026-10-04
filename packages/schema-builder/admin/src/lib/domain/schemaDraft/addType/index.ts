import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';

/** Appends a new type; its name is checked by the schema rules, not here. */
export function addType(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'type.add' }>
): SchemaDocument {
    return { ...doc, types: [...doc.types, action.doc] };
}
