import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/**
 * Replaces a type's General-tab groups. A field left pointing at a group that
 * is gone falls back to the loose fields, as the entry editor would draw it.
 */
export function setGroups(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'groups.set' }>
): SchemaDocument {
    const keys = new Set(action.groups.map((group) => group.key));
    return mapType(doc, action.typeName, (type) => ({
        ...type,
        groups: action.groups,
        fields: type.fields.map((entry) => {
            const group = entry.spec.admin?.group;
            if (!group || keys.has(group)) return entry;
            const admin = { ...entry.spec.admin };
            delete admin.group;
            return { ...entry, spec: { ...entry.spec, admin } };
        })
    }));
}
