/**
 * A human display label for a related record — the first non-empty
 * title-eligible field's value (a short string: text or select), else the id.
 * Mirrors the server's `entryTitle` (`entry-row.ts`) so the relation picker
 * labels rows the same way the bulk-publish preview does.
 */

import type { ContentField } from '../../types/contentType';
import { CONTENT_FIELD_TYPE } from '../../constants';

/** Field types compact enough to label a row by — short strings only. */
const TITLE_FIELD_TYPES: ReadonlySet<string> = new Set([
    CONTENT_FIELD_TYPE.Text,
    CONTENT_FIELD_TYPE.Select
]);

/**
 * The display title for `values` given a type's `fields`, falling back to
 * `fallback` (the record id) when no title-eligible field carries a value.
 */
export function relationLabel(
    values: Record<string, unknown>,
    fields: readonly ContentField[],
    fallback: string
): string {
    for (const field of fields) {
        if (!TITLE_FIELD_TYPES.has(field.type)) continue;
        const value = values[field.name];
        if (typeof value === 'string' && value.trim()) return value;
    }
    return fallback;
}
