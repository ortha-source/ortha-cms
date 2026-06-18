import { and, eq, exists, sql, type SQL } from 'drizzle-orm';
import { scalar } from './scalar-op';
import {
    columnOf,
    primaryKey,
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
 * - `self-referential`: not yet implemented.
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
            const parentKey = rel.parentKey ?? primaryKey(parent);
            const condition = and(
                eq(rel.fk, parentKey),
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
                eq(targetKey, rel.fk),
                descend(rel, rel.table, inner, db)
            );
            return exists(
                db
                    .select({ one: sql`1` })
                    .from(rel.table)
                    .where(condition)
            );
        }
        case RelationKind.SelfReferential:
            throw new Error('self-referential relation not implemented yet');
        case RelationKind.ManyToMany: {
            const parentKey = rel.parentKey ?? primaryKey(parent);
            const onlyTargetFk =
                inner.path.length === 1 && inner.path[0] === 'id';
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
                throw new Error(
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
                            descend(rel, rel.table, inner, db)
                        )
                    )
            );
        }
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
    const next = rel.relations?.[f.path[0]];
    if (!next) throw new Error(`nested relation missing: ${f.path[0]}`);
    return relationExists(
        next,
        currentTable,
        { ...f, path: f.path.slice(1) },
        db
    );
}
