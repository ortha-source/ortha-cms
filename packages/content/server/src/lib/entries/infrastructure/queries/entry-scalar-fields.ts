import {
    ScalarFieldType,
    type ScalarFieldSchema
} from '@ortha-cms/utils-server';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../../types/fields';

/**
 * The filter scalar type for one content field, or `null` to leave it
 * unfilterable. Mirrors the admin's `filterFieldsFromSchema`: text-like fields
 * filter as strings, `select` as an enum of its options, numerics as numbers,
 * dates as dates. `json`/`multiselect`/`media` have no scalar editor, and
 * `relation` filtering (by raw FK uuid) has no UI yet — all skipped.
 */
export function scalarTypeFor(spec: AnyFieldSpec): ScalarFieldSchema | null {
    switch (spec.type) {
        case CONTENT_FIELD_TYPE.Text:
        case CONTENT_FIELD_TYPE.RichText:
        case CONTENT_FIELD_TYPE.Wysiwyg:
            return { type: ScalarFieldType.String };
        case CONTENT_FIELD_TYPE.Select:
            return {
                type: ScalarFieldType.Enum,
                enumValues: spec.options ?? []
            };
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
            return { type: ScalarFieldType.Number };
        case CONTENT_FIELD_TYPE.Boolean:
            return { type: ScalarFieldType.Boolean };
        case CONTENT_FIELD_TYPE.Date:
        case CONTENT_FIELD_TYPE.Datetime:
            return { type: ScalarFieldType.Date };
        default:
            // json / multiselect / media / relation
            return null;
    }
}

/**
 * Whether a field is backed by a comparable scalar column — the single source of
 * truth for "can this field be filtered or sorted". `json`/`multiselect` (jsonb)
 * and `relation` (FK uuid / join table) are not: they have no scalar editor and
 * ordering them is meaningless. The sort whitelist and the filter schema both
 * derive from this, so the two can't drift apart.
 */
export function isScalarField(spec: AnyFieldSpec): boolean {
    return scalarTypeFor(spec) !== null;
}
