import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../../schemaDraftAction';
import { mapType } from '../mapType';

/**
 * Applies a patch to a type's options. A rename is only offered for a type
 * that does not exist yet; the relations that named it follow it.
 */
export function updateType(
    doc: SchemaDocument,
    action: Extract<SchemaDraftAction, { type: 'type.update' }>
): SchemaDocument {
    const patched = mapType(doc, action.name, (type) => ({
        ...type,
        ...action.patch
    }));
    const renamed = action.patch.name;
    if (!renamed || renamed === action.name) return patched;
    return {
        ...patched,
        types: patched.types.map((type) => ({
            ...type,
            fields: type.fields.map((entry) =>
                entry.spec.type === 'relation' && entry.spec.to === action.name
                    ? { ...entry, spec: { ...entry.spec, to: renamed } }
                    : entry
            )
        }))
    };
}
