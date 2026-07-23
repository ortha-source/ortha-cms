import { CONTENT_FIELD_TYPE } from '../constants';
import type {
    ContentField,
    ContentTypeDetail,
    RevisionSnapshot
} from '../types/contentType';

/**
 * One field's before/after across two revision snapshots — the unit the preview
 * renders. `current` is the value in the baseline (the latest revision, i.e. the
 * live record) and `revision` is the value in the version being previewed, so a
 * changed row reads "what restoring this version would put back".
 */
export type RevisionFieldDiff = {
    /** The field's schema (label, type, relation shape). */
    field: ContentField;
    /**
     * Whether the field is stored as a **join-backed** relation set (an owning
     * many-to-many or an inverse) — its value lives in the snapshot's `relations`
     * map as an ordered id list, not in `values`.
     */
    isLinkSet: boolean;
    /** Whether the two snapshots differ on this field. */
    changed: boolean;
    /** The baseline (latest / live) value — a scalar / FK id, or the id[] link set. */
    current: unknown;
    /** The previewed revision's value, same shape as {@link current}. */
    revision: unknown;
};

/** A field whose links live in a join table (owning many, or any inverse). */
function isLinkSet(field: ContentField): boolean {
    return (
        field.type === CONTENT_FIELD_TYPE.Relation &&
        !!field.relation &&
        (field.relation.many || !!field.relation.inverse)
    );
}

/** Treat null / undefined / empty-string as one "empty" so they don't read as a change. */
function normalize(value: unknown): unknown {
    return value == null || value === '' ? null : value;
}

/** Structural equality for scalar / FK / json values (empties collapsed). */
function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Order-sensitive equality for a link set (owning-side order is meaningful). */
function sameLinks(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Diff a previewed revision against a baseline, field by field, in schema order.
 * Scalars / single-relation FKs compare their `values`; join-backed relations
 * compare their ordered `relations` id lists. Pure — no React, no transport —
 * so the preview dialog just renders the result.
 */
export function diffRevision(
    schema: ContentTypeDetail,
    current: RevisionSnapshot,
    revision: RevisionSnapshot
): RevisionFieldDiff[] {
    return schema.fields.map((field) => {
        if (isLinkSet(field)) {
            const cur = current.relations[field.name] ?? [];
            const rev = revision.relations[field.name] ?? [];
            return {
                field,
                isLinkSet: true,
                changed: !sameLinks(cur, rev),
                current: cur,
                revision: rev
            };
        }
        const cur = current.values[field.name];
        const rev = revision.values[field.name];
        return {
            field,
            isLinkSet: false,
            changed: !sameValue(cur, rev),
            current: cur,
            revision: rev
        };
    });
}

/** How many fields changed — for the dialog's summary line. */
export function countChanges(diff: readonly RevisionFieldDiff[]): number {
    return diff.reduce((n, entry) => (entry.changed ? n + 1 : n), 0);
}
