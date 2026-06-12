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
        case 'media':
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
            builder = pgBoolean(col);
            break;
        case 'date':
            builder = pgDate(col);
            break;
        case 'datetime':
            builder = timestamp(col, { withTimezone: true });
            break;
        case 'json':
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

/** Builds the main table + join tables for a content type. */
export function buildTables(
    typeName: string,
    fields: Record<string, AnyFieldSpec>
): BuiltTables {
    const tableName = `content_${snakeCase(typeName)}`;

    const columns: Record<string, PgColumnBuilderBase> = {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Owning workspace. Plain uuid (no FK) until workspace scoping lands. */
        workspaceId: uuid('workspace_id'),
        /** Publish state. */
        status: text('status', { enum: ['draft', 'published'] })
            .notNull()
            .default('draft'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last update timestamp (the service layer refreshes it). */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    };

    for (const [fieldName, spec] of Object.entries(fields)) {
        const column = columnFor(fieldName, spec);
        if (column) columns[fieldName] = column;
    }

    const table = pgTable(tableName, columns, (t) => {
        const cols = t as unknown as Record<string, AnyPgColumn>;
        return [
            // every list view filters by workspace + status
            index(`${tableName}_workspace_status_idx`).on(
                cols['workspaceId'],
                cols['status']
            )
        ];
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
