/**
 * Pure row ↔ entry mappers shared by the read ({@link EntriesService}) and write
 * ({@link EntryWriterService}) paths, so the wire shape and the column projection
 * have one definition each. No DB access, no NestJS — just shape translation.
 */

import type { AnyContentType } from '../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../types/fields';
import type { EntryRecord } from '../types/entry-list-view';

/** A generated content table row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/**
 * Map a raw DB row to the admin {@link EntryRecord}: envelope fields plus a
 * `values` bag keyed by field name. `status` is emitted only for publishable
 * types. Many-relations live in join tables and aren't selected here (single
 * relations pass through as their FK uuid).
 */
export function toRecord(type: AnyContentType, row: Row): EntryRecord {
    const values: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(type.fields)) {
        if (spec.type === CONTENT_FIELD_TYPE.Relation && spec.relation?.many)
            continue;
        values[name] = row[name] ?? null;
    }
    const record: EntryRecord = {
        id: row['id'] as string,
        createdAt: (row['createdAt'] as Date).toISOString(),
        updatedAt: (row['updatedAt'] as Date).toISOString(),
        values
    };
    if (type.publishable) {
        record.status = row['status'] as EntryRecord['status'];
    }
    return record;
}

/**
 * An empty value (mirrors the validation service): null/undefined, a blank
 * string, or an empty array. The admin seeds every untouched field with `''`
 * (or `[]`), so a save carries empties the storage layer must treat as "no
 * value" — null — rather than coerce (e.g. `new Date('')` → Invalid Date).
 */
function isEmpty(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * Normalize the admin's (string-shaped) `values` bag to the proper JS types the
 * validator and storage expect — numbers parsed, JSON text parsed, empties
 * collapsed to null — keeping every field (so a many-relation array still
 * validates). The single coercion point: both {@link toColumns} (storage) and
 * the writer's validation run against the result, so they can't disagree on a
 * value's type. Datetime/date stay ISO strings (the validator accepts them;
 * {@link toColumns} converts datetime to `Date` for `timestamptz`).
 */
export function coerceValues(
    type: AnyContentType,
    values: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(type.fields)) {
        let value = values[name];
        if (isEmpty(value)) {
            out[name] = Array.isArray(value) ? value : null;
            continue;
        }
        switch (spec.type) {
            case CONTENT_FIELD_TYPE.Number:
            case CONTENT_FIELD_TYPE.Money:
                // NaN when unparseable — the validator reports "must be a number".
                value = typeof value === 'number' ? value : Number(value);
                break;
            case CONTENT_FIELD_TYPE.Json:
                if (typeof value === 'string') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        // Leave the raw string; the admin pre-validates JSON.
                    }
                }
                break;
        }
        out[name] = value;
    }
    return out;
}

/**
 * Project a (coerced) `values` bag onto the columns of a generated table for an
 * insert/update. Includes only keys declared on the type (reserved envelope
 * columns — `status`/`published_at`/`deleted_at`/timestamps — are owned by the
 * service, never the client), skips many-relations (their links live in join
 * tables), collapses empties to `null`, converts a `datetime` to a `Date` for
 * the `timestamptz` column (guarding an invalid date to `null` rather than
 * letting `pg` throw), and drops a `NaN` number to `null`. A field absent from
 * `values` is written as `null` — the editor submits the full bag, so a write
 * replaces the whole document.
 */
export function toColumns(
    type: AnyContentType,
    values: Record<string, unknown>
): Record<string, unknown> {
    const columns: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(type.fields)) {
        if (spec.type === CONTENT_FIELD_TYPE.Relation && spec.relation?.many)
            continue;
        let value = values[name];
        if (isEmpty(value)) {
            columns[name] = null;
            continue;
        }
        if (spec.type === CONTENT_FIELD_TYPE.Datetime) {
            const date = value instanceof Date ? value : new Date(String(value));
            value = Number.isNaN(date.getTime()) ? null : date;
        } else if (
            spec.type === CONTENT_FIELD_TYPE.Number ||
            spec.type === CONTENT_FIELD_TYPE.Money
        ) {
            const num = typeof value === 'number' ? value : Number(value);
            value = Number.isNaN(num) ? null : num;
        }
        columns[name] = value;
    }
    return columns;
}

/**
 * A human display label for an entry — the first non-empty `text` field's
 * value, falling back to the id. Used to label rows in the bulk-publish preview.
 */
export function entryTitle(type: AnyContentType, row: Row): string {
    for (const [name, spec] of Object.entries(type.fields)) {
        if (spec.type !== CONTENT_FIELD_TYPE.Text) continue;
        const value = row[name];
        if (typeof value === 'string' && value.trim()) return value;
    }
    return row['id'] as string;
}
