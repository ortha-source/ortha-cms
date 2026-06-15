import { getTableColumns, type AnyColumn, type SQLWrapper } from 'drizzle-orm';

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

/** Resolve a column on a table by name, or throw if absent. */
export function columnOf(table: TableLike, name: string): AnyColumn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = getTableColumns(table as any) as Record<string, AnyColumn>;
    const col = cols[name];
    if (!col) throw new Error(`column "${name}" not on table`);
    return col;
}

/**
 * Resolve a table's primary key (defaults to an `id` column).
 * Callers can override with an explicit `parentKey`/`targetKey` in the
 * relation schema when the table's primary key is named differently.
 */
export function primaryKey(table: TableLike): AnyColumn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = getTableColumns(table as any) as Record<string, AnyColumn>;
    if (cols['id']) return cols['id'];
    throw new Error(
        'table has no `id` column — declare parentKey/targetKey explicitly'
    );
}
