import { isRelativeDefault } from '@orthacms/content-domain';
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

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A relative default at `now`, in the form's own formats — the local calendar
 * date (`YYYY-MM-DD`) or the local minute (`YYYY-MM-DDTHH:mm`), the strings
 * the date field writes, so a prefilled value is indistinguishable from a
 * picked one.
 */
function resolveRelative(type: string, now: Date): string {
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return type === CONTENT_FIELD_TYPE.Datetime
        ? `${day}T${pad(now.getHours())}:${pad(now.getMinutes())}`
        : day;
}

/**
 * The value a **new** entry's form starts one field at: its declared
 * `defaultValue`, else its empty value. Only a create seeds through this — an
 * existing record's untouched field stays empty (`mergeEntryValues`), because
 * a default is what a blank form offers, never what a stored record is
 * assumed to hold.
 */
export function initialValueFor(field: ContentField, now: Date): unknown {
    const value = field.defaultValue;
    if (value === undefined || value === null) return emptyValueFor(field);
    if (isRelativeDefault(field.type, value))
        return resolveRelative(field.type, now);
    // A fresh array, so editing the form never reaches the cached schema.
    return Array.isArray(value) ? [...value] : value;
}

/**
 * The `values` bag a create form starts from — every field at its declared
 * default, or empty. `now` resolves the relative defaults; the caller passes
 * it so one seed reads one clock.
 */
export function initialEntryValues(
    schema: ContentTypeDetail,
    now: Date = new Date()
): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of schema.fields) {
        values[field.name] = initialValueFor(field, now);
    }
    return values;
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
