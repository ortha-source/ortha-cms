import {
    ScalarFieldType,
    type FieldSchema,
    type FilterSchema,
    type ScalarFieldSchema
} from '@ortha-cms/utils-server';
import type { AnyContentType } from '../../types/content-type';
import type { AnyFieldSpec } from '../../types/fields';

/**
 * The filter scalar type for one content field, or `null` to leave it
 * unfilterable. Mirrors the admin's `filterFieldsFromSchema`: text-like fields
 * filter as strings, `select` as an enum of its options, numerics as numbers,
 * dates as dates. `json`/`multiselect` have no scalar editor, and `relation`
 * filtering (by raw FK uuid) has no UI yet — all skipped.
 */
function scalarTypeFor(spec: AnyFieldSpec): ScalarFieldSchema | null {
    switch (spec.type) {
        case 'text':
        case 'richtext':
            return { type: ScalarFieldType.String };
        case 'select':
            return { type: ScalarFieldType.Enum, enumValues: spec.options ?? [] };
        case 'number':
        case 'money':
            return { type: ScalarFieldType.Number };
        case 'boolean':
            return { type: ScalarFieldType.Boolean };
        case 'date':
        case 'datetime':
            return { type: ScalarFieldType.Date };
        default:
            // json / multiselect / relation
            return null;
    }
}

/**
 * Build the query-builder `FilterSchema` for one content type at request time.
 * Whitelists the always-present envelope columns (`createdAt`/`updatedAt`),
 * plus `status`/`publishedAt` only on publishable types, plus every filterable
 * field — keyed by field name, the same ids the admin's `filterFieldsFromSchema`
 * emits and the same property names the engine resolves to table columns. This
 * is the security boundary: only listed fields/ops reach SQL, and the engine's
 * depth/node caps bound payload blow-up.
 */
export function buildEntryFilterSchema(type: AnyContentType): FilterSchema {
    const fields: FieldSchema = {
        createdAt: { type: ScalarFieldType.Date },
        updatedAt: { type: ScalarFieldType.Date }
    };

    // Publish state is filterable only where the column exists.
    if (type.publishable) {
        fields['status'] = {
            type: ScalarFieldType.Enum,
            enumValues: ['draft', 'published']
        };
        fields['publishedAt'] = { type: ScalarFieldType.Date };
    }

    for (const [name, spec] of Object.entries(type.fields)) {
        const scalar = scalarTypeFor(spec);
        if (scalar) fields[name] = scalar;
    }

    return { fields };
}
