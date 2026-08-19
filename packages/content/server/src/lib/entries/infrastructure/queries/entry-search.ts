/**
 * The free-text `?search=` predicate, shared by the admin entries list and the
 * public content API so the two can't drift on which columns are searched or —
 * more importantly — on how the needle is escaped.
 */

import { ilike, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
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
 * The expression a text-like column is matched against.
 *
 * A `richtext` body is a **document** in a `jsonb` column, and `ILIKE` has no
 * meaning against `jsonb` — so it is cast to text and the search runs over the
 * serialized tree. That reaches the words, which is what a reader is looking
 * for; the cost is that a needle spelling one of the tree's own key names
 * (`paragraph`, `heading`) can match a body that never says it. Searching the
 * *text* properly wants a stored, indexed projection of it — worth doing when
 * search is next revisited, and much more than a cast.
 */
function searchable(spec: AnyFieldSpec, column: AnyColumn): AnyColumn | SQL {
    return spec.type === CONTENT_FIELD_TYPE.RichText
        ? sql`${column}::text`
        : column;
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
        .map(([name, spec]) => ilike(searchable(spec, table[name]), pattern));
    return clauses.length ? or(...clauses) : undefined;
}
