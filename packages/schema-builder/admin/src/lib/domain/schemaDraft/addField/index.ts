import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/** Appends a field to a type. */
export function addField(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'field.add' }>
): SchemaDocument {
    return mapType(doc, action.typeName, (type) => ({
        ...type,
        fields: [...type.fields, action.entry]
    }));
}
