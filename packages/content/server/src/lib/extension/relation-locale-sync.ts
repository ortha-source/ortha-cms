import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../types/fields';
import type { AnyContentType } from '../types/content-type';

/**
 * How one relation field behaves across a translation group.
 *
 * The three values are not three author-facing options — the author sets one
 * boolean (`syncAcrossLocales`). What splits `Shared` from `Mirrored` is the
 * **target type**: a link to non-localized content is the same row for every
 * language, while a link to localized content has to name that content's row
 * *in each sibling's own locale* — a shared FK there would be a cross-locale
 * link, which {@link assertSameLocale} rejects and nothing would ever repair.
 */
export const RELATION_LOCALE_SYNC = {
    /** One target row for the whole group — the same id in every sibling. */
    Shared: 'shared',
    /** The target's translation *group*, resolved into each sibling's locale. */
    Mirrored: 'mirrored',
    /** Not propagated: each locale keeps its own links. */
    None: 'none'
} as const;

/** How a relation field propagates across a translation group. */
export type RelationLocaleSync =
    (typeof RELATION_LOCALE_SYNC)[keyof typeof RELATION_LOCALE_SYNC];

/**
 * The propagation mode of one field on `owner` — **the** definition, consulted
 * by the schema serializer, the i18n sibling sync, and the copilot's
 * translation applier, so the three cannot drift.
 *
 * `None` for everything that has nothing to propagate: a non-relation, a
 * non-`i18n` owner (no siblings), an inverse field (it reuses the owning side's
 * storage, so syncing from both ends would write the same links twice), and any
 * relation whose author set `syncAcrossLocales: false`.
 *
 * The target's i18n-ness is read via the resolved thunk `spec.relation.to()` —
 * safe because the registry resolves every relation target at boot.
 */
export function relationLocaleSync(
    owner: AnyContentType,
    spec: AnyFieldSpec
): RelationLocaleSync {
    if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
        return RELATION_LOCALE_SYNC.None;
    if (!owner.i18n) return RELATION_LOCALE_SYNC.None;
    if (spec.relation.inverse) return RELATION_LOCALE_SYNC.None;
    if (!spec.relation.syncAcrossLocales) return RELATION_LOCALE_SYNC.None;
    return spec.relation.to().i18n
        ? RELATION_LOCALE_SYNC.Mirrored
        : RELATION_LOCALE_SYNC.Shared;
}

/**
 * Whether a field's stored value **varies from one locale row to the next** —
 * what the schema serializer reports to the admin as `localized`, and what the
 * translation prefill uses to decide a field is the translator's to fill in.
 *
 * True for an explicitly `localized` field, and for a relation that is either
 * mirrored (each sibling stores its own locale's target id) or unsynced (each
 * sibling stores whatever it was given). False for a **shared** relation, whose
 * every sibling genuinely holds the same id.
 *
 * Note the difference from {@link relationLocaleSync}: a *mirrored* relation is
 * both per-locale AND propagated — the value differs per row precisely so that
 * every row points at the right translation.
 */
export function isPerLocaleField(
    owner: AnyContentType,
    spec: AnyFieldSpec
): boolean {
    if (spec.localized) return true;
    if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
        return false;
    if (!owner.i18n || spec.relation.inverse) return false;
    return relationLocaleSync(owner, spec) !== RELATION_LOCALE_SYNC.Shared;
}

/**
 * Whether a relation's links live in a join table (an owning many-to-many)
 * rather than in a `<field>_id` column. The two storage forms are synced by
 * different machinery — a column write vs. a join-row rewrite — so the sync
 * pass splits on this.
 *
 * An **inverse** is excluded even though it is join-backed: it owns no writable
 * link from its side.
 */
export function isJoinBackedRelation(spec: AnyFieldSpec): boolean {
    return (
        spec.type === CONTENT_FIELD_TYPE.Relation &&
        !!spec.relation?.many &&
        !spec.relation.inverse
    );
}
