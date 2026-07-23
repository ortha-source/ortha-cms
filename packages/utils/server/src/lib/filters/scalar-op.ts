import {
    eq,
    gt,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    ne,
    notIlike,
    notInArray,
    or,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { FilterOperator } from './types';

/**
 * A negative predicate that also matches NULL.
 *
 * SQL's three-valued logic makes `col <> 'x'`, `col NOT IN (…)` and
 * `col NOT ILIKE '%x%'` all evaluate to NULL — i.e. *not matched* — when
 * the column is NULL. That reads as a silent data-loss bug to an editor:
 * a publishable type keeps its required fields **nullable** (they're only
 * required to publish), so "Title does not contain foo" would quietly hide
 * every draft whose title is still empty. An empty value is not the value
 * being excluded, so it belongs in the result.
 */
function negative(col: AnyColumn, predicate: SQL): SQL {
    return or(predicate, isNull(col)) as SQL;
}

/**
 * Translate a single operator + value pair against `col` into a Drizzle
 * SQL fragment. Array-valued ops (`in`/`nin`) expect the caller's value
 * to already be an array; `null` expects a boolean.
 *
 * Negative operators are NULL-inclusive — see {@link negative}. (On a
 * relation path a negative operator never reaches here: the translator
 * rewrites it into `NOT EXISTS(… positive …)` first, which is the only
 * correct reading once the relation can hold more than one row.)
 */
export function scalar(
    col: AnyColumn,
    op: FilterOperator,
    value: unknown
): SQL {
    switch (op) {
        case FilterOperator.Eq:
            return eq(col, value);
        case FilterOperator.Ne:
            return negative(col, ne(col, value));
        case FilterOperator.Gt:
            return gt(col, value);
        case FilterOperator.Gte:
            return gte(col, value);
        case FilterOperator.Lt:
            return lt(col, value);
        case FilterOperator.Lte:
            return lte(col, value);
        case FilterOperator.In:
            return inArray(col, value as unknown[]);
        case FilterOperator.Nin:
            return negative(col, notInArray(col, value as unknown[]));
        case FilterOperator.Like:
            return like(col, String(value));
        case FilterOperator.Ilike:
            return ilike(col, String(value));
        case FilterOperator.Nilike:
            return negative(col, notIlike(col, String(value)));
        case FilterOperator.Null:
            return value === true ? isNull(col) : isNotNull(col);
    }
}
