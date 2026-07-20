/**
 * Content-type contracts: a code-defined collection (multi-entry) or
 * single (standalone page). Definitions live in the HOST app (it owns
 * their migrations, like any schema owner); this plugin owns the
 * registry, serialization, and validation machinery around them.
 */

import type { PgTable } from 'drizzle-orm/pg-core';
import type { AnyFieldSpec, FieldValue } from './fields';

/**
 * Multi-entry collection vs. standalone page — mirrors the established
 * `ContentTypeDescriptor` contract. The runtime object is the source of truth;
 * the {@link ContentTypeKind} union is derived from it.
 */
export const CONTENT_TYPE_KIND = {
    Collection: 'collection',
    Single: 'single'
} as const;

/** Multi-entry collection vs. standalone page. */
export type ContentTypeKind =
    (typeof CONTENT_TYPE_KIND)[keyof typeof CONTENT_TYPE_KIND];

/**
 * Publish-state values carried by the `status` envelope column of a
 * `publishable` type. The runtime object is the source of truth for the
 * generated column enum, the filter schema, and the admin — so the set can't
 * drift across them.
 */
export const ENTRY_STATUS = {
    Draft: 'draft',
    Published: 'published'
} as const;

/** Publish state of an entry on a publishable type. */
export type EntryStatus = (typeof ENTRY_STATUS)[keyof typeof ENTRY_STATUS];

/** Options accepted by `collection()` / `single()`. */
export interface ContentTypeOptions<
    TFields extends Record<string, AnyFieldSpec>
> {
    /** Human label; falls back to the name. */
    label?: string;
    /** Short description shown in pickers (workspace wizard, admin). */
    description?: string;
    /**
     * Track when an entry was published: adds a reserved, nullable
     * `published_at` envelope column the platform owns. Authors cannot define
     * it as a field, and clients cannot set it directly.
     */
    publishable?: boolean;
    /**
     * Soft-delete: adds a reserved, nullable `deleted_at` envelope column. A
     * deleted entry is tombstoned (its `deleted_at` set) rather than removed.
     * Authors cannot define it as a field, and clients cannot set it directly.
     */
    paranoid?: boolean;
    /**
     * Row-per-locale localization: adds reserved `locale` + `locale_group_id`
     * envelope columns the platform owns. Each locale of an entry is a full
     * row; sibling rows share a `locale_group_id`. What a locale *means*
     * (available slugs, the default, scoping, sync) is owned by the bound
     * localization plugin via the `CONTENT_ENTRY_EXTENSION` port — this
     * package only provides the storage shape.
     */
    i18n?: boolean;
    /** The field map — keys become column names (snake_cased). */
    fields: TFields;
}

/** Extra options for `single()` (pages). */
export interface SingleOptions<TFields extends Record<string, AnyFieldSpec>>
    extends ContentTypeOptions<TFields> {
    /** Route path the page renders at, e.g. '/about'. */
    path: string;
}

/**
 * A defined content type: the serializable spec plus the physical
 * Drizzle tables generated from it. `table` (and any `joinTables`) are
 * what the host re-exports for drizzle-kit to diff into migrations.
 */
export interface ContentType<
    TFields extends Record<string, AnyFieldSpec> = Record<string, AnyFieldSpec>
> {
    /** Stable machine name / slug (snake_case). */
    readonly name: string;
    readonly kind: ContentTypeKind;
    readonly label: string;
    readonly description?: string;
    /** Route path — singles only. */
    readonly path?: string;
    /** Tracks publish time via a `published_at` envelope column. */
    readonly publishable: boolean;
    /** Soft-deletes via a `deleted_at` envelope column. */
    readonly paranoid: boolean;
    /** Row-per-locale via `locale` + `locale_group_id` envelope columns. */
    readonly i18n: boolean;
    readonly fields: TFields;
    /** The generated Postgres table (`content_<name>`). */
    readonly table: PgTable;
    /** Generated join tables, keyed by the many-relation field name. */
    readonly joinTables: Record<string, PgTable>;
}

/** Any content type, regardless of its field map. */
export type AnyContentType = ContentType<Record<string, AnyFieldSpec>>;

/**
 * Envelope columns an entry row carries. `id`/`workspaceId`/`createdAt`/
 * `updatedAt` are always present; `status`/`publishedAt` exist only on
 * `publishable` types, `deletedAt` only on `paranoid` types — hence optional.
 * A fully type-level guarantee ("`status` ⟺ `publishable`") would require the
 * flags to be literal-typed generics on the content type, a larger refactor.
 */
export interface EntryEnvelope {
    /** Primary key. */
    id: string;
    /** Owning workspace (plain uuid until workspace scoping lands). */
    workspaceId: string | null;
    createdAt: Date;
    updatedAt: Date;
    /** Publish state — present only on `publishable` types. */
    status?: 'draft' | 'published';
    /** Publish timestamp — present (nullable) only on `publishable` types. */
    publishedAt?: Date | null;
    /** Soft-delete tombstone — present (nullable) only on `paranoid` types. */
    deletedAt?: Date | null;
    /** Locale slug of this row — present only on `i18n` types. */
    locale?: string;
    /** Shared id across a translation group — present only on `i18n` types. */
    localeGroupId?: string;
}

/** The field values of a content type, null-aware via each field's `required`. */
export type InferValues<C extends AnyContentType> = {
    [K in keyof C['fields']]: FieldValue<C['fields'][K]>;
};

/**
 * The full row type of a content type — envelope plus typed values.
 *
 * @example
 *   export const post = collection('post', { fields: { … } });
 *   type Post = InferEntry<typeof post>;   // { id, status, …, title: string, … }
 */
export type InferEntry<C extends AnyContentType> = EntryEnvelope &
    InferValues<C>;
