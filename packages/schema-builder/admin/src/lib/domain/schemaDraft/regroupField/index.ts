import type {
    FieldEntry,
    SchemaDocument
} from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/**
 * Moves a field into a group on General — or out of one, to the loose fields —
 * and lands it before another field, by key, or last. Inside a group the
 * declared order is what the editor draws; above the groups the editor
 * re-sorts by rank, so there the position only matters within one. A group
 * the type does not declare, or a key that is not there, changes nothing.
 */
export function regroupField(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'field.regroup' }>
): SchemaDocument {
    return mapType(doc, action.typeName, (type) => {
        const moving = type.fields.find((entry) => entry.key === action.key);
        if (!moving || action.before === action.key) return type;
        if (
            action.group !== null &&
            !type.groups.some((group) => group.key === action.group)
        )
            return type;
        const rest = type.fields.filter((entry) => entry !== moving);
        const at =
            action.before === null
                ? rest.length
                : rest.findIndex((entry) => entry.key === action.before);
        if (at < 0) return type;
        rest.splice(at, 0, inGroup(moving, action.group));
        return { ...type, fields: rest };
    });
}

/** The field with `admin.group` set — or dropped, so it falls back to loose. */
function inGroup(entry: FieldEntry, group: string | null): FieldEntry {
    const admin = { ...entry.spec.admin };
    if (group === null) delete admin.group;
    else admin.group = group;
    return { ...entry, spec: { ...entry.spec, admin } };
}
