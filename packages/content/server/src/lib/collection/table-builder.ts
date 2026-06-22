/**
 * Turns a field map into physical Drizzle tables. One table per content
 * type (`content_<name>`), plus one join table per many-relation
 * (`content_<name>_<field>`). The HOST re-exports these from its
 * drizzle-kit schema entry, so collection changes become ordinary
 * committed migrations — exactly like any plugin-owned schema.
 */

import {
    boolean as pgBoolean,
    date as pgDate,
    doublePrecision,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
    type AnyPgColumn,
    type PgColumnBuilderBase,
    type PgTable
} from 'drizzle-orm/pg-core';
import type { AnyFieldSpec } from '../types/fields';

/** camelCase / kebab-case → snake_case column-safe identifier. */
export function snakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .toLowerCase();
}

/**
 * The `id` column of a generated table. Generated tables are built from a
 * dynamic column record, so their columns aren't statically typed — but the
 * envelope guarantees `id` exists on every one of them.
 */
function idColumnOf(table: PgTable): AnyPgColumn {
    return (table as unknown as { id: AnyPgColumn }).id;
}

/** Builds the column for one (non-many-relation) field. */
function columnFor(
    fieldName: string,
    spec: AnyFieldSpec
): PgColumnBuilderBase | null {
    const col = snakeCase(fieldName);
    let builder;
    switch (spec.type) {
        case 'text':
        case 'richtext':
        case 'select':
            builder = text(col);
            break;
        case 'number':
            builder = spec.validation.integer
                ? integer(col)
                : doublePrecision(col);
            break;
        case 'money':
            // integer minor units — exact arithmetic, no float drift
            builder = integer(col);
            break;
        case 'boolean':
            // A required boolean defaults to false so an omitted value is a
            // concrete `false` rather than a NOT NULL violation.
            builder = spec.required
                ? pgBoolean(col).default(false)
                : pgBoolean(col);
            break;
        case 'date':
            builder = pgDate(col);
            break;
        case 'datetime':
            builder = timestamp(col, { withTimezone: true });
            break;
        case 'json':
        case 'multiselect':
            builder = jsonb(col);
            break;
        case 'relation': {
            if (spec.relation?.many) return null; // join table instead
            // Lazy reference: the thunk resolves at query/diff time, so
            // mutually-referencing collections can import each other.
            builder = uuid(`${col}_id`).references(
                () => idColumnOf(spec.relation!.to().table),
                { onDelete: spec.relation!.onDelete }
            );
            break;
        }
    }
    return spec.required ? builder.notNull() : builder;
}

/** Result of building a content type's physical schema. */
export interface BuiltTables {
    table: PgTable;
    joinTables: Record<string, PgTable>;
}

/** Platform-owned envelope columns toggled by content-type metadata flags. */
export interface TableMeta {
    /** Add a nullable `published_at` column. */
    publishable?: boolean;
    /** Add a nullable `deleted_at` column (soft delete). */
    paranoid?: boolean;
}

/** Builds the main table + join tables for a content type. */
export function buildTables(
    typeName: string,
    fields: Record<string, AnyFieldSpec>,
    meta: TableMeta = {}
): BuiltTables {
    const tableName = `content_${snakeCase(typeName)}`;

    const columns: Record<string, PgColumnBuilderBase> = {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Owning workspace. Plain uuid (no FK) until workspace scoping lands. */
        workspaceId: uuid('workspace_id'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last update timestamp (the service layer refreshes it). */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    };

    // Publish workflow is opt-in: only a `publishable` type carries a
    // draft/published `status` and the `published_at` stamp — two halves of
    // the same concept. A non-publishable type has no publish state; every row
    // is simply live. `published_at` is nullable with no default (null = "not
    // yet published"; the service layer stamps it).
    if (meta.publishable) {
        columns['status'] = text('status', { enum: ['draft', 'published'] })
            .notNull()
            .default('draft');
        columns['publishedAt'] = timestamp('published_at', {
            withTimezone: true
        });
    }
    // Soft delete: nullable `deleted_at` (null = "not deleted"; service stamps it).
    if (meta.paranoid) {
        columns['deletedAt'] = timestamp('deleted_at', { withTimezone: true });
    }

    for (const [fieldName, spec] of Object.entries(fields)) {
        const column = columnFor(fieldName, spec);
        if (column) columns[fieldName] = column;
    }

    const table = pgTable(tableName, columns, (t) => {
        const cols = t as unknown as Record<string, AnyPgColumn>;
        // Every list view filters by workspace; publishable types also filter
        // by status, so fold it into the index only where the column exists.
        return meta.publishable
            ? [
                  index(`${tableName}_workspace_status_idx`).on(
                      cols['workspaceId'],
                      cols['status']
                  )
              ]
            : [index(`${tableName}_workspace_idx`).on(cols['workspaceId'])];
    });

    const joinTables: Record<string, PgTable> = {};
    for (const [fieldName, spec] of Object.entries(fields)) {
        if (spec.type !== 'relation' || !spec.relation?.many) continue;
        const joinName = `${tableName}_${snakeCase(fieldName)}`;
        joinTables[fieldName] = pgTable(
            joinName,
            {
                /** The owning entry. Join rows die with it. */
                sourceId: uuid('source_id')
                    .notNull()
                    .references(() => idColumnOf(table), {
                        onDelete: 'cascade'
                    }),
                /** The referenced entry on the target type. */
                targetId: uuid('target_id')
                    .notNull()
                    .references(() => idColumnOf(spec.relation!.to().table), {
                        onDelete: 'cascade'
                    })
            },
            (t) => {
                const cols = t as unknown as Record<string, AnyPgColumn>;
                return [
                    // one link per pair; leftmost prefix covers "links of an entry"
                    unique(`${joinName}_pair_unique`).on(
                        cols['sourceId'],
                        cols['targetId']
                    ),
                    // reverse lookups: "which entries reference this target?"
                    index(`${joinName}_target_idx`).on(cols['targetId'])
                ];
            }
        );
    }

    return { table, joinTables };
}
