/**
 * Content-type contracts: a code-defined collection (multi-entry) or
 * single (standalone page). Definitions live in the HOST app (it owns
 * their migrations, like any schema owner); this plugin owns the
 * registry, serialization, and validation machinery around them.
 */

import type { PgTable } from 'drizzle-orm/pg-core';
import type { AnyFieldSpec, FieldValue } from './fields';

/** Multi-entry collection vs. standalone page — mirrors the established `ContentTypeDescriptor` contract. */
export type ContentTypeKind = 'collection' | 'single';

/** Options accepted by `collection()` / `single()`. */
export interface ContentTypeOptions<
    TFields extends Record<string, AnyFieldSpec>
> {
    /** Human label; falls back to the name. */
    label?: string;
    /** Short description shown in pickers (workspace wizard, admin). */
    description?: string;
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
    readonly fields: TFields;
    /** The generated Postgres table (`content_<name>`). */
    readonly table: PgTable;
    /** Generated join tables, keyed by the many-relation field name. */
    readonly joinTables: Record<string, PgTable>;
}

/** Any content type, regardless of its field map. */
export type AnyContentType = ContentType<Record<string, AnyFieldSpec>>;

/** Envelope columns every entry row carries. */
export interface EntryEnvelope {
    /** Primary key. */
    id: string;
    /** Owning workspace (plain uuid until workspace scoping lands). */
    workspaceId: string | null;
    /** Publish state. */
    status: 'draft' | 'published';
    createdAt: Date;
    updatedAt: Date;
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
