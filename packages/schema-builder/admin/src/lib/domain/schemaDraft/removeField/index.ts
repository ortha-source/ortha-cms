import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/** Drops a field by its key. */
export function removeField(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'field.remove' }>
): SchemaDocument {
    return mapType(doc, action.typeName, (type) => ({
        ...type,
        fields: type.fields.filter((entry) => entry.key !== action.key)
    }));
}
