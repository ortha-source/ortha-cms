/**
 * The **published view** of a publishable type — what a public reader is
 * served — expressed as CTEs that shadow the physical tables by name.
 *
 * The problem it solves: a publishable entry's row is its **working copy**.
 * Saving a published entry (an edit, a restore of an older version) returns the
 * row to `draft` while the previously published version stays `published` in
 * `content_entry_revisions` — the admin's **Modified**. A public read that
 * filtered the row on `status = 'published'` therefore lost the entry the
 * moment anyone touched it, and could not have served it anyway without
 * leaking the unpublished edits.
 *
 * Here a Modified row is read through its published revision instead: the
 * field columns come from the snapshot's `values`, `status` reads `published`,
 * and `updated_at` is when that version was written. Every other row passes
 * through untouched. A join table gets the same treatment from the snapshot's
 * `relations`, so a published entry's links are the ones it was published with.
 *
 * **Why a CTE named like the table.** Postgres resolves an unqualified name to a
 * CTE before a table, so `WITH "content_article" AS (…) SELECT … FROM
 * "content_article" WHERE …` runs every predicate the caller already builds —
 * the workspace scope, `status`, the locale scope, the read scopes, `?search=`,
 * `?filter=` — against the published view without any of them changing. That is
 * the point: filtering or sorting on the working copy would let a reader probe
 * an unpublished edit ("which entry now matches `title eq …`?"), and building a
 * second set of predicates for the view is how the two would drift.
 *
 * Inside a non-recursive CTE its own name still means the table, and a later
 * sibling is invisible to an earlier one — so {@link publishedViews} lists the
 * join-table views **before** the entry view: they read the entry table to find
 * Modified rows and must see the real one.
 *
 * Only a public read attaches these. The admin, the writers and a
 * `?status=draft|any` read all keep reading the working copy.
 */

import {
    getTableColumns,
    getTableName,
    sql,
    type SQL,
    type WithSubquery
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Database } from '@orthacms/database';
import { contentEntryRevisions } from '../../../revisions/infrastructure/persistence/revision-table';
import { REVISION_STATUS } from '../../../revisions/domain/revision-status';
import { ENTRY_STATUS, type AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';

/** The alias of the physical row inside a view. */
const BASE = sql.identifier('__live_base');
/** The alias of the entry's published revision (null unless Modified). */
const REV = sql.identifier('__live_rev');
/** The alias of the snapshot's values, typed as a row of the table. */
const DOC = sql.identifier('__live_doc');
/** The alias of one physical join row. */
const LINK = sql.identifier('__live_link');

/**
 * `jsonb_build_object` is a variadic function, and Postgres caps a call at 100
 * arguments — 50 key/value pairs. A wider type is built in chunks and merged.
 */
const PAIRS_PER_OBJECT = 50;

/**
 * The published revision of the row aliased {@link BASE}, as a `LATERAL`
 * sub-select yielding `snapshot` and `created_at` — or no row at all when the
 * row is not a draft (a published row *is* its published version) or has no
 * published revision (never published, or unpublished since).
 *
 * `LIMIT 1` newest-first rather than trusting "at most one live version" to
 * hold: `markPublished` keeps that invariant in application code, and a second
 * published revision must not duplicate the entry in a list.
 */
function publishedRevision(type: AnyContentType): SQL {
    const statusColumn = columnName(type, 'status');
    return sql`lateral (
        select ${contentEntryRevisions.snapshot} as snapshot,
               ${contentEntryRevisions.createdAt} as created_at
          from ${contentEntryRevisions}
         where ${BASE}.${sql.identifier(statusColumn)} = ${ENTRY_STATUS.Draft}
           and ${contentEntryRevisions.entryId} = ${BASE}.${sql.identifier(columnName(type, 'id'))}
           and ${contentEntryRevisions.workspaceId} = ${BASE}.${sql.identifier(columnName(type, 'workspaceId'))}
           and ${contentEntryRevisions.contentType} = ${type.name}
           and ${contentEntryRevisions.status} = ${REVISION_STATUS.Published}
         order by ${contentEntryRevisions.revisionNumber} desc
         limit 1
    )`;
}

/** The physical column name behind a property of a type's table. */
function columnName(type: AnyContentType, property: string): string {
    const columns = getTableColumns(type.table) as Record<string, PgColumn>;
    return columns[property].name;
}

/**
 * Whether a table property is a **field** whose value the revision snapshot
 * carries in `values` — every column-backed field, keyed by its field name
 * (an owning single relation's `<field>_id` FK included).
 */
function isSnapshotField(type: AnyContentType, property: string): boolean {
    const spec = Object.hasOwn(type.fields, property)
        ? type.fields[property]
        : undefined;
    if (!spec) return false;
    return !(
        spec.type === CONTENT_FIELD_TYPE.Relation &&
        (spec.relation?.many || spec.relation?.inverse)
    );
}

/**
 * The published view of `type`'s own table, or `undefined` for a type with no
 * publish state (every row of it is simply live).
 *
 * One row per physical row, in the table's own column names, so it is a
 * drop-in for the table. The snapshot's values are cast back to the columns'
 * types by `jsonb_populate_record` against the table's own row type, which is
 * what keeps a `timestamptz`, a `numeric` or a `jsonb` field the type a reader
 * gets from the table. A field added after the version was published is absent
 * from its snapshot and reads `null`, exactly as that version had it.
 */
export function publishedEntriesView(
    db: Database,
    type: AnyContentType
): WithSubquery | undefined {
    if (!type.publishable) return undefined;
    const name = getTableName(type.table);
    const columns = getTableColumns(type.table) as Record<string, PgColumn>;
    const fields = Object.keys(columns).filter((property) =>
        isSnapshotField(type, property)
    );

    const pairs = fields.map(
        (property) =>
            sql`${columns[property].name}::text, ${REV}.snapshot -> 'values' -> ${property}::text`
    );
    const objects: SQL[] = [];
    for (let at = 0; at < pairs.length; at += PAIRS_PER_OBJECT) {
        objects.push(
            sql`jsonb_build_object(${sql.join(pairs.slice(at, at + PAIRS_PER_OBJECT), sql`, `)})`
        );
    }
    const document = objects.length
        ? sql.join(objects, sql` || `)
        : sql`'{}'::jsonb`;

    const modified = sql`${REV}.snapshot is not null`;
    const select = Object.entries(columns).map(([property, column]) => {
        const physical = sql.identifier(column.name);
        if (isSnapshotField(type, property)) {
            return sql`case when ${modified} then ${DOC}.${physical} else ${BASE}.${physical} end as ${physical}`;
        }
        if (property === 'status') {
            return sql`case when ${modified} then ${ENTRY_STATUS.Published} else ${BASE}.${physical} end as ${physical}`;
        }
        if (property === 'updatedAt') {
            return sql`case when ${modified} then ${REV}.created_at else ${BASE}.${physical} end as ${physical}`;
        }
        return sql`${BASE}.${physical} as ${physical}`;
    });

    return db.$with(name, {}).as(
        sql`select ${sql.join(select, sql`, `)}
              from ${type.table} as ${BASE}
              left join ${publishedRevision(type)} as ${REV} on true
              left join lateral jsonb_populate_record(null::${sql.identifier(name)}, ${document}) as ${DOC} on true`
    );
}

/**
 * The published view of one owning many-relation's join table — the links
 * `owner` entries were **published with**. A Modified owner's links come from
 * its published snapshot's `relations[field]`, in the snapshot's order; every
 * other owner's join rows pass through. `undefined` on a type with no publish
 * state.
 *
 * Serves both directions: the owning side reads its targets from it, and the
 * inverse side of the same relation (which reuses this table, swapped) sees an
 * owner linking it exactly when the owner's published version does.
 */
export function publishedLinksView(
    db: Database,
    owner: AnyContentType,
    field: string
): WithSubquery | undefined {
    if (!owner.publishable || !Object.hasOwn(owner.joinTables, field)) {
        return undefined;
    }
    const join = owner.joinTables[field];
    const columns = getTableColumns(join) as Record<string, PgColumn>;
    const source = sql.identifier(columns['sourceId'].name);
    const target = sql.identifier(columns['targetId'].name);
    const position = sql.identifier(columns['position'].name);
    const id = sql.identifier(columnName(owner, 'id'));
    const links = sql`${REV}.snapshot -> 'relations' -> ${field}::text`;

    return db.$with(getTableName(join), {}).as(
        sql`select ${LINK}.${source} as ${source},
                   ${LINK}.${target} as ${target},
                   ${LINK}.${position} as ${position}
              from ${join} as ${LINK}
             where not exists (
                   select 1
                     from ${owner.table} as ${BASE}
                    cross join ${publishedRevision(owner)} as ${REV}
                    where ${BASE}.${id} = ${LINK}.${source}
             )
            union all
            select ${BASE}.${id},
                   linked.value::uuid,
                   linked.ordinality::double precision
              from ${owner.table} as ${BASE}
             cross join ${publishedRevision(owner)} as ${REV}
             cross join lateral jsonb_array_elements_text(
                   case when jsonb_typeof(${links}) = 'array'
                        then ${links} else '[]'::jsonb end
             ) with ordinality as linked(value, ordinality)`
    );
}

/**
 * Every view a public read of `type` attaches, in a valid `WITH` order: the
 * views of the type's own join tables first, then the view of the type itself
 * (see the module docs for why the order matters). Empty for a type with no
 * publish state.
 */
export function publishedViews(
    db: Database,
    type: AnyContentType
): WithSubquery[] {
    const views = Object.keys(type.joinTables).map((field) =>
        publishedLinksView(db, type, field)
    );
    views.push(publishedEntriesView(db, type));
    return views.filter((view): view is WithSubquery => !!view);
}
