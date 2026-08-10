/**
 * `collection()` / `single()` — the two entry points of the content DSL.
 * Both normalize options, build the physical tables, and return a typed
 * {@link ContentType} the host registers via `ContentPlugin({ types })`
 * and re-exports (the tables) for drizzle-kit.
 */

import type { PgTable } from 'drizzle-orm/pg-core';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../types/fields';
import {
    CONTENT_TYPE_KIND,
    type AnyContentType,
    type ContentType,
    type ContentTypeOptions,
    type SingleOptions
} from '../types/content-type';
import { buildTables, snakeCase } from './table-builder';

/** Valid machine names: snake_case, starting with a letter. */
const NAME_RE = /^[a-z][a-z0-9_]*$/;

function assertName(name: string): void {
    if (!NAME_RE.test(name)) {
        throw new Error(
            `Content type name "${name}" must be snake_case ` +
                `(letters, digits, underscores; starting with a letter).`
        );
    }
}

/**
 * Envelope columns the platform owns (see {@link buildTables}). Reserved
 * unconditionally — even the metadata-gated `published_at` / `deleted_at`, so a
 * field name can never collide with a column we might add, and the meaning of
 * these names stays fixed across the codebase.
 */
const RESERVED_COLUMNS = new Set([
    'id',
    'workspace_id',
    'status',
    'created_at',
    'updated_at',
    'published_at',
    'deleted_at',
    'locale',
    'locale_group_id'
]);

/**
 * The physical main-table column a field maps to, or `null` for a
 * many-relation (which lives in its own join table, not a column). A
 * single relation becomes a `<field>_id` FK column — mirror that here so
 * collision detection sees the real column name, not the bare field name.
 */
function mainColumnName(fieldName: string, spec: AnyFieldSpec): string | null {
    if (spec.type === CONTENT_FIELD_TYPE.Relation) {
        // Inverse (virtual) and many-relations have no main-table column.
        if (spec.relation?.inverse || spec.relation?.many) return null;
        return `${snakeCase(fieldName)}_id`;
    }
    return snakeCase(fieldName);
}

function assertFields(
    typeName: string,
    fields: Record<string, AnyFieldSpec>,
    i18n: boolean
): void {
    const names = Object.keys(fields);
    if (names.length === 0) {
        throw new Error(`Content type "${typeName}" defines no fields.`);
    }
    const seen = new Map<string, string>();
    for (const name of names) {
        const spec = fields[name];

        // `localized` only means something on a row-per-locale type; on any
        // other type the flag would silently do nothing — fail loudly instead.
        if (spec.localized && !i18n) {
            throw new Error(
                `Field "${name}" on "${typeName}" is localized, but the type ` +
                    `does not set i18n: true.`
            );
        }

        // `unique` enforces one-to-one via a UNIQUE constraint on the single
        // FK column. A many-relation has no such column (its links live in a
        // join table), so `unique` is meaningless there — reject it rather
        // than silently ignore it.
        if (
            spec.type === CONTENT_FIELD_TYPE.Relation &&
            spec.relation?.many &&
            spec.relation.unique
        ) {
            throw new Error(
                `Relation "${typeName}.${name}" sets unique: true with ` +
                    `many: true — a many-relation has no FK column to constrain. ` +
                    `Drop one of them.`
            );
        }

        // `syncAcrossLocales` describes propagation across a translation
        // group, so on a type with no locale siblings it can only mislead —
        // an author setting it there believes something is happening. The
        // builder defaults it to `true`, so only an explicit `false` (which
        // an author can only have written deliberately) is detectable here.
        if (
            spec.type === CONTENT_FIELD_TYPE.Relation &&
            spec.relation &&
            !spec.relation.inverse &&
            !spec.relation.syncAcrossLocales &&
            !spec.localized &&
            !i18n
        ) {
            throw new Error(
                `Relation "${typeName}.${name}" sets syncAcrossLocales, but ` +
                    `"${typeName}" does not set i18n: true — it has no locale ` +
                    `siblings to propagate to.`
            );
        }

        // `localized: true` on a relation IS `syncAcrossLocales: false` (the
        // builder reads it as the default), so declaring both in contradiction
        // asks for two opposite things and one would have to win silently.
        if (
            spec.type === CONTENT_FIELD_TYPE.Relation &&
            spec.relation &&
            !spec.relation.inverse &&
            spec.localized &&
            spec.relation.syncAcrossLocales
        ) {
            throw new Error(
                `Relation "${typeName}.${name}" sets localized: true with ` +
                    `syncAcrossLocales: true — localized means each locale keeps ` +
                    `its own links, which is the opposite. Drop one of them.`
            );
        }

        // A required single relation with ON DELETE SET NULL is a
        // contradiction: the FK column is NOT NULL, so nulling it on a
        // parent delete always fails — the delete can never succeed. (An
        // inverse field has no FK column, so the rule doesn't apply.)
        if (
            spec.type === CONTENT_FIELD_TYPE.Relation &&
            spec.relation &&
            !spec.relation.inverse &&
            !spec.relation.many &&
            spec.required &&
            spec.relation.onDelete === 'set null'
        ) {
            throw new Error(
                `Relation "${typeName}.${name}" is required but its onDelete is ` +
                    `'set null' — a NOT NULL foreign key cannot be nulled on delete. ` +
                    `Use 'cascade' or 'restrict'.`
            );
        }

        const column = mainColumnName(name, spec);
        if (column === null) continue; // many-relation: no main-table column

        if (RESERVED_COLUMNS.has(column)) {
            throw new Error(
                `Field "${name}" on "${typeName}" maps to column "${column}", ` +
                    `which collides with an envelope column.`
            );
        }
        const existing = seen.get(column);
        if (existing) {
            throw new Error(
                `Fields "${existing}" and "${name}" on "${typeName}" both map to ` +
                    `column "${column}".`
            );
        }
        seen.set(column, name);
    }
}

/**
 * The generated join table for a many-relation field, or throw. Use this in
 * the host's drizzle-kit schema entry (`re-export`) so a renamed or removed
 * many-relation fails loudly at load instead of silently resolving to
 * `undefined` and dropping the join table from the generated migration.
 */
export function joinTableOf(type: AnyContentType, field: string): PgTable {
    const table = type.joinTables[field];
    if (!table) {
        throw new Error(
            `Content type "${type.name}" has no join table for ` +
                `many-relation "${field}".`
        );
    }
    return table;
}

/**
 * Defines a multi-entry collection.
 *
 * @example
 *   export const post = collection('post', {
 *       label: 'Blog posts',
 *       fields: {
 *           title: field.text({ required: true }),
 *           author: field.relation({ to: () => author })
 *       }
 *   });
 */
export function collection<TFields extends Record<string, AnyFieldSpec>>(
    name: string,
    options: ContentTypeOptions<TFields>
): ContentType<TFields> {
    assertName(name);
    const publishable = options.publishable ?? false;
    const paranoid = options.paranoid ?? false;
    const i18n = options.i18n ?? false;
    assertFields(name, options.fields, i18n);
    const { table, joinTables } = buildTables(name, options.fields, {
        publishable,
        paranoid,
        i18n
    });
    return {
        name,
        kind: CONTENT_TYPE_KIND.Collection,
        label: options.label ?? name,
        description: options.description,
        publishable,
        paranoid,
        i18n,
        fields: options.fields,
        table,
        joinTables
    };
}

/**
 * Defines a single (a standalone page with a route path). Same storage
 * model as a collection — the admin just treats it as one entry.
 */
export function single<TFields extends Record<string, AnyFieldSpec>>(
    name: string,
    options: SingleOptions<TFields>
): ContentType<TFields> {
    assertName(name);
    if (!options.path.startsWith('/')) {
        throw new Error(
            `Single "${name}" path must start with "/" (got "${options.path}").`
        );
    }
    const publishable = options.publishable ?? false;
    const paranoid = options.paranoid ?? false;
    const i18n = options.i18n ?? false;
    assertFields(name, options.fields, i18n);
    const { table, joinTables } = buildTables(name, options.fields, {
        publishable,
        paranoid,
        i18n
    });
    return {
        name,
        kind: CONTENT_TYPE_KIND.Single,
        label: options.label ?? name,
        description: options.description,
        path: options.path,
        publishable,
        paranoid,
        i18n,
        fields: options.fields,
        table,
        joinTables
    };
}
