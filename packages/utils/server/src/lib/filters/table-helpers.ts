import { getTableColumns, type AnyColumn, type SQLWrapper } from 'drizzle-orm';
import { FilterSchemaException } from './filter-exceptions';

/**
 * A minimal Drizzle-like table shape.
 *
 * We deliberately do NOT import drizzle-orm's `Table`/`PgTable` here:
 * drizzle's generic `Column`/`TableConfig` use a protected field that
 * breaks structural assignment between utils-server and callers'
 * concrete `PgTableWithColumns<…>` types under nodenext resolution.
 * The parser is the runtime whitelist that keeps this safe.
 */
export type TableLike = object;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A minimal Drizzle-like database shape. Only `.select().from()` and
 * `.innerJoin()` are used; parameter/return types are widened so
 * concrete Drizzle instances (e.g. `NodePgDatabase`) assign here
 * without cross-package nominal friction.
 */
export type DbLike = {
    select: (...args: any[]) => {
        from: (t: any) => {
            where: (cond: any) => SQLWrapper;
            innerJoin: (
                t: any,
                cond: any
            ) => {
                where: (cond: any) => SQLWrapper;
            };
        };
    };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Resolve a column on a table by name, or throw if absent.
 *
 * The lookup is `Object.hasOwn`-guarded: drizzle's column map is a plain
 * object, so `cols['constructor']` would otherwise return `Object` itself and
 * this function would hand a `Function` to drizzle as a `Column`. The parser's
 * whitelist is the primary guard, but this is the site where an escaped name
 * turns into malformed SQL rather than an error, so it guards itself too.
 */
export function columnOf(table: TableLike, name: string): AnyColumn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = getTableColumns(table as any) as Record<string, AnyColumn>;
    const col = Object.hasOwn(cols, name) ? cols[name] : undefined;
    if (!col) throw new FilterSchemaException(`column "${name}" not on table`);
    return col;
}

/**
 * Re-resolve a prebuilt column against the table the translator is actually
 * querying.
 *
 * A `RelationSchema`'s parent-side columns (`fk` on a `many-to-one` /
 * `self-referential`, and every `parentKey`) are built once, against the
 * **physical** parent table. That is wrong the moment the parent is an
 * *alias* — which happens for every relation nested under a
 * `self-referential` hop, whose subquery is `FROM t AS qb_x`. An unaliased
 * `t.col` inside that subquery is still resolvable from the OUTERMOST
 * query's `FROM t`, so Postgres silently binds the correlation to the root
 * row instead of the aliased one: `parent.author.name` would filter on the
 * ROOT row's author, and `parent.parent.name` would collapse to
 * `parent.name`. Valid SQL, wrong rows, no error.
 *
 * Rebinding by the column's own DB name against the queried table fixes the
 * correlation. It is a no-op when the parent is the physical table (the
 * lookup finds the identical column), so unaliased paths are unaffected.
 * Only ever call this for columns that live on the parent **by
 * construction** — never for a target-side `fk` (`one-to-many`), where the
 * name could collide with an unrelated parent column.
 */
export function rebind(column: AnyColumn, table: TableLike): AnyColumn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = getTableColumns(table as any) as Record<string, AnyColumn>;
    for (const candidate of Object.values(cols)) {
        if (candidate.name === column.name) return candidate;
    }
    return column;
}

/**
 * Resolve a table's primary key (defaults to an `id` column).
 * Callers can override with an explicit `parentKey`/`targetKey` in the
 * relation schema when the table's primary key is named differently.
 */
export function primaryKey(table: TableLike): AnyColumn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = getTableColumns(table as any) as Record<string, AnyColumn>;
    if (Object.hasOwn(cols, 'id')) return cols['id'];
    throw new FilterSchemaException(
        'table has no `id` column — declare parentKey/targetKey explicitly'
    );
}
