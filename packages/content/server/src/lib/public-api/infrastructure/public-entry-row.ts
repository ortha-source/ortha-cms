/**
 * The row → {@link PublicEntry} projection. Pure shape translation: no DB
 * access, no NestJS. Separate from the admin's `toRecord` because the public
 * wire contract is its own thing (see `types/public-entry.ts`).
 */

import type { AnyContentType } from '../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../types/fields';
import type { PublicEntry } from '../types/public-entry';

/** A generated content table row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/**
 * Field types the public read omits entirely — every kind whose value is a
 * **reference to something else** rather than the entry's own data.
 *
 * `relation` covers all four cardinalities: an owning many-relation and an
 * inverse have no column to read anyway, and an owning single one does (a
 * `<field>_id` FK) but is dropped too, so the rule is one line rather than a
 * per-cardinality carve-out. `media` is an asset id (or a list of them) in the
 * media plugin's own store.
 *
 * The public API resolves neither today, so emitting a bare uuid would hand a
 * consumer an identifier with nothing to do with it. **This is deliberately
 * provisional** — when relation and media reads land, this set shrinks and the
 * omitted fields start appearing in `values`, which is an additive change.
 */
const REFERENCE_FIELD_TYPES: ReadonlySet<string> = new Set([
    CONTENT_FIELD_TYPE.Relation,
    CONTENT_FIELD_TYPE.Media
]);

/**
 * Whether a field carries the entry's **own** value — a scalar, a `json` or
 * `multiselect` bag, anything stored in the row and meaningful on its own.
 * See {@link REFERENCE_FIELD_TYPES} for what this excludes and why.
 */
export function isPureValueField(
    spec: AnyContentType['fields'][string]
): boolean {
    return !REFERENCE_FIELD_TYPES.has(spec.type);
}

/**
 * Projects a raw DB row onto the public wire shape: the envelope (`id`,
 * timestamps, plus `publishedAt` / locale columns where the type has them) and
 * a `values` bag of the entry's **own** field values — every field except the
 * reference kinds (see {@link REFERENCE_FIELD_TYPES}). An unset field reads
 * back as `null`, never as a missing key, so the key set is stable across
 * entries of a type.
 *
 * `selected` narrows `values` to a `?fields=` sparse fieldset. It must be
 * passed whenever the row was read with a narrowed projection: without it the
 * loop would emit `title: null` for a column the query never selected, which
 * reads as "this entry has no title" rather than "you didn't ask for it".
 */
export function toPublicEntry(
    type: AnyContentType,
    row: Row,
    selected?: ReadonlySet<string>
): PublicEntry {
    const values: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(type.fields)) {
        if (!isPureValueField(spec)) continue;
        if (selected && !selected.has(name)) continue;
        values[name] = row[name] ?? null;
    }

    const entry: PublicEntry = {
        id: row['id'] as string,
        createdAt: (row['createdAt'] as Date).toISOString(),
        updatedAt: (row['updatedAt'] as Date).toISOString(),
        values
    };
    if (type.publishable) {
        const publishedAt = row['publishedAt'] as Date | null | undefined;
        entry.publishedAt = publishedAt ? publishedAt.toISOString() : null;
    }
    if (type.i18n) {
        entry.locale = row['locale'] as string;
        entry.localeGroupId = row['localeGroupId'] as string;
    }
    return entry;
}
