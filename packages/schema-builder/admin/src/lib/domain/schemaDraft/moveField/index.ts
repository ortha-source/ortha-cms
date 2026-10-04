import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/**
 * Moves a field to where another one is, by key — the list's positions differ
 * from the document's (the General tab re-sorts by rank), keys do not. Keys
 * travel with their fields, so a move is only a `field.reorder` in the diff.
 */
export function moveField(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'field.move' }>
): SchemaDocument {
    return mapType(doc, action.typeName, (type) => {
        const from = type.fields.findIndex((entry) => entry.key === action.key);
        const to = type.fields.findIndex(
            (entry) => entry.key === action.before
        );
        if (from < 0 || to < 0 || from === to) return type;
        const fields = [...type.fields];
        const [moved] = fields.splice(from, 1);
        fields.splice(to, 0, moved);
        return { ...type, fields };
    });
}
