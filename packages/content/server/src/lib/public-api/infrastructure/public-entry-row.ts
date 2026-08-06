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
 * Whether a field has a column on the entry's own table. An owning
 * many-relation stores its links in a join table and an inverse relation reuses
 * the owning side's storage, so neither has a value to project — the public
 * read is flat and omits them.
 */
function isColumnBacked(spec: AnyContentType['fields'][string]): boolean {
    return !(
        spec.type === CONTENT_FIELD_TYPE.Relation &&
        (spec.relation?.many || spec.relation?.inverse)
    );
}

/**
 * Projects a raw DB row onto the public wire shape: the envelope (`id`,
 * timestamps, plus `publishedAt` / locale columns where the type has them) and
 * a `values` bag of every column-backed field. An unset field reads back as
 * `null`, never as a missing key, so a consumer can rely on the schema's field
 * list matching the keys it gets.
 */
export function toPublicEntry(type: AnyContentType, row: Row): PublicEntry {
    const values: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(type.fields)) {
        if (!isColumnBacked(spec)) continue;
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
