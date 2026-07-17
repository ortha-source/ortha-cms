import type { ContentField, ContentTypeDetail } from '../types/contentType';
import { CONTENT_FIELD_TYPE } from '../constants';

/**
 * The empty form value for one field — a *defined* value per type so every
 * input is controlled from first render (no React "uncontrolled → controlled"
 * warning): multi-valued fields an empty array, every text/scalar field an empty
 * string. A **required** boolean defaults to `false` (its column is NOT NULL
 * DEFAULT false); an **optional** boolean defaults to `null` so an untouched
 * toggle round-trips as "unset" rather than being silently written `false` — the
 * editor submits the full values bag and the server replaces the whole document,
 * and `false` is not "empty", so a fabricated default would persist. The toggle
 * renders `null` as the off ("Disabled") state, staying controlled.
 */
export function emptyValueFor(field: ContentField): unknown {
    switch (field.type) {
        case CONTENT_FIELD_TYPE.Boolean:
            return field.required ? false : null;
        case CONTENT_FIELD_TYPE.Multiselect:
            return [];
        case CONTENT_FIELD_TYPE.Relation:
            return field.relation?.many ? [] : '';
        default:
            return '';
    }
}

/** A blank `values` bag for a content type — every field at its empty value. */
export function emptyEntryValues(
    schema: ContentTypeDetail
): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of schema.fields) {
        values[field.name] = emptyValueFor(field);
    }
    return values;
}

/**
 * Merge a record's stored `values` over the empty defaults, so a field the
 * record omits (e.g. one added to the schema after the row was written) still
 * has a controlled value. Unknown keys in `stored` are dropped — the schema is
 * the contract.
 */
export function mergeEntryValues(
    schema: ContentTypeDetail,
    stored: Record<string, unknown>
): Record<string, unknown> {
    const values = emptyEntryValues(schema);
    for (const field of schema.fields) {
        if (field.name in stored && stored[field.name] != null) {
            values[field.name] = stored[field.name];
        }
    }
    return values;
}
