/**
 * Turns a field map into physical Drizzle tables. One table per content
 * type (`content_<name>`), plus one join table per many-relation
 * (`content_<name>_<field>`). The HOST re-exports these from its
 * drizzle-kit schema entry, so collection changes become ordinary
 * committed migrations — exactly like any plugin-owned schema.
 */

import { isNull } from 'drizzle-orm';
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
    uniqueIndex,
    uuid,
    type AnyPgColumn,
    type PgColumnBuilderBase,
    type PgTable
} from 'drizzle-orm/pg-core';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../types/fields';
import { ENTRY_STATUS } from '../types/content-type';

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

/**
 * Builds the column for one (non-many-relation) field.
 *
 * `enforceRequired` decides the NOT NULL constraint: a **non-publishable** type
 * is always live, so a required field is `NOT NULL`. A **publishable** type has
 * a draft stage where a required field may legitimately be empty — "required"
 * means "required *to publish*", enforced by `EntryValidationService` at publish
 * time, not the column. So a publishable type's columns stay nullable even when
 * the field is required.
 */
function columnFor(
    fieldName: string,
    spec: AnyFieldSpec,
    enforceRequired: boolean
): PgColumnBuilderBase | null {
    const col = snakeCase(fieldName);
    let builder;
    switch (spec.type) {
        case CONTENT_FIELD_TYPE.Text:
        case CONTENT_FIELD_TYPE.RichText:
        case CONTENT_FIELD_TYPE.Select:
            builder = text(col);
            break;
        case CONTENT_FIELD_TYPE.Number:
            builder = spec.validation.integer
                ? integer(col)
                : doublePrecision(col);
            break;
        case CONTENT_FIELD_TYPE.Money:
            // integer minor units — exact arithmetic, no float drift
            builder = integer(col);
            break;
        case CONTENT_FIELD_TYPE.Boolean:
            // A required boolean defaults to false so an omitted value is a
            // concrete `false` rather than a NOT NULL violation. The default is
            // useful regardless of whether NOT NULL is ultimately enforced.
            builder = spec.required
                ? pgBoolean(col).default(false)
                : pgBoolean(col);
            break;
        case CONTENT_FIELD_TYPE.Date:
            builder = pgDate(col);
            break;
        case CONTENT_FIELD_TYPE.Datetime:
            builder = timestamp(col, { withTimezone: true });
            break;
        case CONTENT_FIELD_TYPE.Json:
        case CONTENT_FIELD_TYPE.Multiselect:
            builder = jsonb(col);
            break;
        case CONTENT_FIELD_TYPE.Relation: {
            // An inverse (back-reference) owns no storage — it reuses the owning
            // side's column/join table.
            if (spec.relation?.inverse) return null;
            if (spec.relation?.many) return null; // join table instead
            // Lazy reference: the thunk resolves at query/diff time, so
            // mutually-referencing collections can import each other.
            builder = uuid(`${col}_id`).references(
                () => idColumnOf(spec.relation!.to().table),
                { onDelete: spec.relation!.onDelete }
            );
            // One-to-one: at most one owner may point at a given target.
            // Nullable-unique — Postgres allows many NULLs, so owners with no
            // relation don't collide.
            if (spec.relation!.unique) builder = builder.unique();
            break;
        }
    }
    return enforceRequired && spec.required ? builder.notNull() : builder;
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
    /** Add NOT NULL `locale` + `locale_group_id` columns (row-per-locale). */
    i18n?: boolean;
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
        /**
         * Owning workspace. Stamped on create and filtered on every read/write
         * by the entries services (scoped via `WorkspaceGuard`'s `X-Workspace-Id`
         * header), so entries never cross workspaces. Plain uuid, no FK — the
         * `workspaces` table lives in the identity plugin's schema, which this
         * package can't reference; isolation is enforced in the app layer.
         */
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
        columns['status'] = text('status', {
            enum: [ENTRY_STATUS.Draft, ENTRY_STATUS.Published]
        })
            .notNull()
            .default(ENTRY_STATUS.Draft);
        columns['publishedAt'] = timestamp('published_at', {
            withTimezone: true
        });
    }
    // Soft delete: nullable `deleted_at` (null = "not deleted"; service stamps it).
    if (meta.paranoid) {
        columns['deletedAt'] = timestamp('deleted_at', { withTimezone: true });
    }
    // Row-per-locale: each locale of an entry is a full row; siblings share a
    // `locale_group_id`. The group id defaults to a fresh uuid so a plain
    // create starts its own translation group — linking into an existing group
    // (translation creation) sets it explicitly. The slug's meaning (allowed
    // values, the default) is owned by the bound localization plugin.
    if (meta.i18n) {
        columns['locale'] = text('locale').notNull();
        columns['localeGroupId'] = uuid('locale_group_id')
            .notNull()
            .defaultRandom();
    }

    // Publishable types keep required columns nullable (a draft may be
    // incomplete; publish enforces requiredness). Non-publishable types are
    // always live, so a required field is NOT NULL.
    const enforceRequired = !meta.publishable;
    for (const [fieldName, spec] of Object.entries(fields)) {
        const column = columnFor(fieldName, spec, enforceRequired);
        if (column) columns[fieldName] = column;
    }

    const table = pgTable(tableName, columns, (t) => {
        const cols = t as unknown as Record<string, AnyPgColumn>;
        // Every list view filters by workspace; i18n types also filter by
        // locale, and publishable types by status — fold each into the list
        // index only where the column exists.
        const listColumns = [
            cols['workspaceId'],
            ...(meta.i18n ? [cols['locale']] : []),
            ...(meta.publishable ? [cols['status']] : [])
        ];
        const listIndexName = meta.i18n
            ? `${tableName}_workspace_locale_idx`
            : meta.publishable
              ? `${tableName}_workspace_status_idx`
              : `${tableName}_workspace_idx`;
        const indexes = [
            index(listIndexName).on(listColumns[0], ...listColumns.slice(1))
        ];
        // Each owning single relation's FK. The *inverse* of such a relation is
        // read by filtering this column (`inArray(fk, sourceIds)` in
        // `RelationLinkService.previewInverse`), which the records table now
        // runs for a whole page on every render — unindexed that is a sequential
        // scan of the collection per keystroke, sort click and page change.
        // `unique: true` already implies an index, so skip those.
        for (const [fieldName, spec] of Object.entries(fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Relation) continue;
            if (
                spec.relation?.many ||
                spec.relation?.inverse ||
                spec.relation?.unique
            )
                continue;
            const fk = cols[fieldName];
            if (!fk) continue;
            indexes.push(
                index(`${tableName}_${snakeCase(fieldName)}_id_idx`).on(fk)
            );
        }
        if (meta.i18n) {
            // One row per (group, locale). Partial on paranoid types so a
            // soft-deleted sibling never blocks re-creating that locale —
            // restoring into a conflict then fails (23505 → 409 upstream).
            const groupLocale = uniqueIndex(
                `${tableName}_group_locale_unique`
            ).on(cols['localeGroupId'], cols['locale']);
            indexes.push(
                meta.paranoid
                    ? groupLocale.where(isNull(cols['deletedAt']))
                    : groupLocale
            );
        }
        return indexes;
    });

    const joinTables: Record<string, PgTable> = {};
    for (const [fieldName, spec] of Object.entries(fields)) {
        if (
            spec.type !== CONTENT_FIELD_TYPE.Relation ||
            !spec.relation?.many ||
            spec.relation.inverse // inverse reuses the owning side's join table
        )
            continue;
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
                    }),
                /**
                 * Ordinal of this target within its **source's** ordered list —
                 * the source's own ordering of its many-relation, so a
                 * drag-reorder survives a reload. Float, so a target can be moved
                 * between two neighbours without renumbering the whole list.
                 * Defaults to 0 (append picks `max(position)+1` for the source).
                 * The inverse side reads by it too (stable), but doesn't own the
                 * order — a two-way link has one order, the owning side's.
                 */
                position: doublePrecision('position').notNull().default(0)
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
                    index(`${joinName}_target_idx`).on(cols['targetId']),
                    // ordered read of a source's links: `WHERE source_id ORDER BY position`
                    index(`${joinName}_source_pos_idx`).on(
                        cols['sourceId'],
                        cols['position']
                    )
                ];
            }
        );
    }

    return { table, joinTables };
}
