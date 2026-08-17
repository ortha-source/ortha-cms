import { and, eq, exists, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PgTable } from 'drizzle-orm/pg-core';
import { FilterSchemaException } from './filter-exceptions';
import { own } from './own-property';
import { scalar } from './scalar-op';
import {
    columnOf,
    primaryKey,
    rebind,
    type DbLike,
    type TableLike
} from './table-helpers';
import { RelationKind } from './types';
import type { ParsedFilter, RelationSchema } from './types';

/**
 * Build an `EXISTS (...)` subquery that applies `inner` against the
 * relation's target/through table. The `kind` discriminant selects the
 * SQL shape:
 *
 * - `one-to-one` / `one-to-many`: target FK references parent.
 * - `many-to-one`: parent FK references target.
 * - `many-to-many`: join via `through`; add inner join to target when
 *   filtering on a target field.
 * - `self-referential`: parent and target are the same physical table,
 *   so the target is aliased to give the subquery its own correlation
 *   name (an unaliased subquery would bind both correlation sides to the
 *   inner scope and silently degrade to "a row that is its own parent").
 *
 * Every branch ANDs the relation's optional `scope` predicate (workspace
 * + soft-delete guard) inside the EXISTS, so a relation filter never
 * traverses rows the root query itself excludes.
 *
 * Every column that lives on the PARENT side (`fk` for `many-to-one` /
 * `self-referential`, and any `parentKey`) is re-resolved against `parent`
 * via {@link rebind}, because `parent` may be an alias of the physical
 * table — see that helper for why an unaliased column silently correlates
 * to the wrong row.
 */
export function relationExists(
    rel: RelationSchema,
    parent: TableLike,
    inner: ParsedFilter,
    db: DbLike
): SQL {
    switch (rel.kind) {
        case RelationKind.OneToOne:
        case RelationKind.OneToMany: {
            const parentKey = rel.parentKey
                ? rebind(rel.parentKey, parent)
                : primaryKey(parent);
            const condition = and(
                eq(rel.fk, parentKey),
                rel.scope?.(rel.table),
                descend(rel, rel.table, inner, db)
            );
            return exists(
                db
                    .select({ one: sql`1` })
                    .from(rel.table)
                    .where(condition)
            );
        }
        case RelationKind.ManyToOne: {
            const targetKey = rel.targetKey ?? primaryKey(rel.table);
            const condition = and(
                eq(targetKey, rebind(rel.fk, parent)),
                rel.scope?.(rel.table),
                descend(rel, rel.table, inner, db)
            );
            return exists(
                db
                    .select({ one: sql`1` })
                    .from(rel.table)
                    .where(condition)
            );
        }
        case RelationKind.SelfReferential: {
            // Parent and target are the same physical table, so an
            // unaliased subquery would bind BOTH sides of the correlation
            // to the inner scope. The alias gives the inner table its own
            // correlation name; `rel.fk` stays bound to the OUTER row.
            const target = alias(rel.table as PgTable, rel.alias);
            const targetKey = columnOf(target, 'id');
            const condition = and(
                eq(targetKey, rebind(rel.fk, parent)),
                rel.scope?.(target),
                descend(rel, target, inner, db)
            );
            return exists(
                db
                    .select({ one: sql`1` })
                    .from(target)
                    .where(condition)
            );
        }
        case RelationKind.ManyToMany: {
            const parentKey = rel.parentKey
                ? rebind(rel.parentKey, parent)
                : primaryKey(parent);
            // The junction-only fast path reads the target FK straight off
            // the join row, skipping the target table. A `scope` lives on
            // that target table, so it can only be enforced through the
            // join — the fast path must yield to it, or `relation.id in (…)`
            // would silently bypass the workspace / soft-delete guards that
            // `relation.field` enforces.
            const onlyTargetFk =
                !rel.scope && inner.path.length === 1 && inner.path[0] === 'id';
            if (onlyTargetFk) {
                return exists(
                    db
                        .select({ one: sql`1` })
                        .from(rel.through)
                        .where(
                            and(
                                eq(rel.fk, parentKey),
                                scalar(rel.targetFk, inner.op, inner.value)
                            )
                        )
                );
            }
            if (!rel.table) {
                throw new FilterSchemaException(
                    'many-to-many filter on target field requires `table`'
                );
            }
            const targetKey = rel.targetKey ?? primaryKey(rel.table);
            return exists(
                db
                    .select({ one: sql`1` })
                    .from(rel.through)
                    .innerJoin(rel.table, eq(targetKey, rel.targetFk))
                    .where(
                        and(
                            eq(rel.fk, parentKey),
                            rel.scope?.(rel.table),
                            descend(rel, rel.table, inner, db)
                        )
                    )
            );
        }
        default:
            // Unreachable through the `RelationSchema` union, but a schema
            // assembled at runtime can carry an unrecognised `kind`. Falling
            // out of the switch returned `undefined`, and an `undefined`
            // predicate is dropped by drizzle's `and()`/`or()` — the filter
            // would silently widen instead of failing.
            throw new FilterSchemaException(
                `relation declares unknown kind "${String(
                    (rel as { kind?: unknown }).kind
                )}"`
            );
    }
}

/**
 * Apply the next segment of a filter path against `currentTable`.
 * If the path has one segment left it resolves to a scalar condition;
 * otherwise it descends through the next nested relation.
 */
export function descend(
    rel: RelationSchema,
    currentTable: TableLike,
    f: ParsedFilter,
    db: DbLike
): SQL {
    if (f.path.length === 1) {
        return scalar(columnOf(currentTable, f.path[0]), f.op, f.value);
    }
    const next = own(rel.relations, f.path[0]);
    if (!next)
        throw new FilterSchemaException(
            `nested relation missing: ${f.path[0]}`
        );
    return relationExists(
        next,
        currentTable,
        { ...f, path: f.path.slice(1) },
        db
    );
}
