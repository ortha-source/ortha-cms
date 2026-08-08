/**
 * Wire contracts for the public content API (`/api/v1/...`). Kept separate from
 * the admin's `EntryRecord` on purpose: this is a **published contract** an
 * external site or app builds against, so it must be free to stay still while
 * the admin's internal shape evolves.
 */

import type {
    PublicMediaFieldView,
    PublicRelationFieldView
} from './public-expansion';

/**
 * One entry as the public API serves it: the storage envelope plus a flat
 * `values` bag keyed by field name.
 *
 * `values` carries the entry's **own** data only — text, richtext, number,
 * money, boolean, date, datetime, select, multiselect, and json. Every
 * **reference** field is omitted: `relation` in all four cardinalities and
 * `media`. Neither is resolvable through this API yet, so returning a bare
 * uuid would hand a consumer an identifier it has no route to follow.
 *
 * That omission is **provisional**, not the intended end state. The schema
 * endpoint still describes the omitted fields, because they are part of the
 * real content model; when relation and media reads land they begin appearing
 * in `values`, which only ever adds keys.
 *
 * `status` is carried on publishable types. It used to be omitted as a
 * constant — this API only ever served published rows — but a write-scoped
 * token can now create drafts and read them back with `?status=`, so it is real
 * information again. Adding it is additive: a consumer that ignored the key
 * before still sees `published` on every entry a read-only token can reach.
 */
export interface PublicEntry {
    /** Entry id — the `:id` segment of the single-entry route. */
    id: string;
    /**
     * `draft` or `published` — only on `publishable` types. A read-only token
     * only ever sees `published`.
     *
     * `draft` with a non-null {@link publishedAt} is the admin's **Modified**
     * state: live content with unpublished edits on top. Saving a published
     * entry moves it back to `draft` while its published *version* stays live,
     * so the pair is what tells those apart — neither field alone does.
     */
    status?: string;
    /** ISO creation timestamp. */
    createdAt: string;
    /** ISO last-updated timestamp. */
    updatedAt: string;
    /**
     * ISO timestamp of when this entry last went live — only on `publishable`
     * types. Never null in a public response: an entry with no published
     * version is not served at all.
     */
    publishedAt?: string | null;
    /** Locale slug of this row — only on `i18n` types. */
    locale?: string;
    /** Shared translation-group id — only on `i18n` types, so a consumer can
     * correlate an entry with its other translations. */
    localeGroupId?: string;
    /** The entry's own field values, keyed by field name (see the note above
     * on which kinds are omitted). */
    values: Record<string, unknown>;
    /**
     * Relation links, keyed by field name — present only when the caller opts
     * in with `?relations=preview&relationFields=…`. Each field carries at most
     * one page of refs plus the true count of *visible* links.
     */
    relations?: Record<string, PublicRelationFieldView>;
    /**
     * Media assets, keyed by field name — present only when the caller opts in
     * with `?media=preview&mediaFields=…`. Read the URL caveat on
     * {@link PublicMediaRef} before pointing a browser at one.
     */
    media?: Record<string, PublicMediaFieldView>;
    /**
     * The entry's **other** locale rows — the rest of its translation group —
     * present only when the caller opts in with `?translations=preview` on a
     * localized type. Ordered by locale slug, and each is a full
     * {@link PublicEntry} honouring the same `?fields=` selection as the root,
     * so a language switcher reads `[entry, ...entry.translations]`.
     *
     * The entry itself is **not** repeated here: it is the row you asked for,
     * in the locale you asked for. Only published, non-deleted siblings appear,
     * so a locale that exists but is still a draft is absent — the same
     * visibility rule as every other public read. Siblings are not themselves
     * expanded: their `relations`, `media`, and `translations` are absent.
     */
    translations?: PublicEntry[];
}

/** One page of public entries. */
export interface PublicEntryListView {
    items: PublicEntry[];
    /** Total matching entries, ignoring pagination. */
    total: number;
    /** 1-based page number this page represents. */
    page: number;
    /** Rows per page actually applied. */
    pageSize: number;
}
