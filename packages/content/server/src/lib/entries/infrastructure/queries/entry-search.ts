/**
 * The free-text `?search=` predicate, shared by the admin entries list and the
 * public content API so the two can't drift on which columns are searched or —
 * more importantly — on how the needle is escaped.
 */

import { ilike, or, type AnyColumn, type SQL } from 'drizzle-orm';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../../types/fields';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/** Columns the free-text search scans (they hold searchable textual content). */
export function isTextLike(spec: AnyFieldSpec): boolean {
    return (
        spec.type === CONTENT_FIELD_TYPE.Text ||
        spec.type === CONTENT_FIELD_TYPE.RichText ||
        spec.type === CONTENT_FIELD_TYPE.Select
    );
}

/**
 * Case-insensitive `ILIKE` across the type's text-like columns, OR-ed together;
 * `undefined` when there is no search term (so it collapses out of an `and()`).
 *
 * The needle's LIKE metacharacters are escaped, so a literal `%` or `_`
 * searches literally instead of turning the query into a wildcard scan.
 */
export function buildSearchPredicate(
    type: AnyContentType,
    search: string | undefined
): SQL | undefined {
    const needle = search?.trim();
    if (!needle) {
        return undefined;
    }
    const table = type.table as unknown as ContentTable;
    const pattern = `%${needle.replace(/[\\%_]/g, '\\$&')}%`;
    const clauses = Object.entries(type.fields)
        .filter(([, spec]) => isTextLike(spec))
        .map(([name]) => ilike(table[name], pattern));
    return clauses.length ? or(...clauses) : undefined;
}
