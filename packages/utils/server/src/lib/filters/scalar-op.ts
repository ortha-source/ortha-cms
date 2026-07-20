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
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { FilterOperator } from './types';

/**
 * Translate a single operator + value pair against `col` into a Drizzle
 * SQL fragment. Array-valued ops (`in`/`nin`) expect the caller's value
 * to already be an array; `null` expects a boolean.
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
            return ne(col, value);
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
            return notInArray(col, value as unknown[]);
        case FilterOperator.Like:
            return like(col, String(value));
        case FilterOperator.Ilike:
            return ilike(col, String(value));
        case FilterOperator.Nilike:
            return notIlike(col, String(value));
        case FilterOperator.Null:
            return value === true ? isNull(col) : isNotNull(col);
    }
}
