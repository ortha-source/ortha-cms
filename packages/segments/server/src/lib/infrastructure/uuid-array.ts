import { sql, type SQL } from 'drizzle-orm';

/**
 * A list of segment ids as **one** `uuid[]` bind parameter.
 *
 * ```sql
 * $1::uuid[]     -- with $1 bound to {a,b}
 * ```
 *
 * `` sql`${ids}::uuid[]` `` looks like it does this and does not. Drizzle
 * expands a JS array in a template into one placeholder **per element**,
 * comma-separated — which is what makes an `in (…)` list work, and which against
 * a `::uuid[]` cast produces a different broken query for every length:
 *
 * - none — `()::uuid[]`, a syntax error, i.e. the **anonymous reader**, who is
 *   the one case that must always work;
 * - one — `($1)::uuid[]` with a scalar bound, so Postgres reads a uuid as an
 *   array literal and answers `malformed array literal`;
 * - two — `($1, $2)::uuid[]`, a row constructor rather than an array.
 *
 * `sql.param` binds the array itself and node-postgres serialises it as `{…}`,
 * including `{}` for the empty case. Every `&&` overlap in this plugin goes
 * through here for that reason — the mistake is invisible in an emitted-SQL
 * assertion (the shape is right; only the placeholders are wrong) and shows up
 * as a 500 the first time a real reader is resolved.
 */
export function uuidArray(ids: readonly string[]): SQL {
    return sql`${sql.param([...ids])}::uuid[]`;
}
