import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/**
 * Replaces a field's name and options. The key stays: it is how the diff
 * tells a rename from a remove plus an add.
 */
export function updateField(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'field.update' }>
): SchemaDocument {
    return mapType(doc, action.typeName, (type) => ({
        ...type,
        fields: type.fields.map((entry) =>
            entry.key === action.key
                ? { key: entry.key, name: action.name, spec: action.spec }
                : entry
        )
    }));
}
