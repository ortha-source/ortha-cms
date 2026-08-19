import { FilterOperator, ScalarFieldType } from './types';

/**
 * Which operators each declared scalar type can actually be asked.
 *
 * The third axis of a filter leaf. `resolveLeaf` already validated the **field**
 * (against the schema whitelist) and the **value** (against the field's declared
 * type); nothing validated that the **operator** is one the underlying column
 * can answer. So `?filter={"field":"embargoUntil","op":"ilike","value":"%2020%"}`
 * passed both checks and reached Postgres as
 * `"embargo_until" ilike $3`, which raises
 * `operator does not exist: timestamp with time zone ~~* unknown` — a
 * **user-triggerable 500 from a shareable link** on every filterable endpoint,
 * reported as an unhandled driver error rather than as a per-field issue the
 * client can render.
 *
 * The table is drawn from what the **column type can answer**, not from what a
 * UI chooses to offer. The admin's `OPS_FOR_TYPE` is deliberately narrower —
 * it drops `eq` on dates (its editor is minute-precision against a millisecond
 * `timestamptz`) and everything but `eq` on booleans — but those are editor
 * ergonomics, not SQL legality, and this is the boundary an API token, a
 * hand-written URL and the GraphQL adapter all cross. Rejecting a legal
 * `publishedAt eq <instant>` here would be a regression, not a fix.
 *
 * What that leaves is the pattern family: `like` / `ilike` / `nilike` are the
 * `~~` operator class, which Postgres defines for text only. Every non-textual
 * column type therefore rejects them, and everything else stays as permissive
 * as the database is. `null` (IS NULL) and `in`/`nin` are legal on every type.
 */
const PATTERN_OPERATORS: readonly FilterOperator[] = [
    FilterOperator.Like,
    FilterOperator.Ilike,
    FilterOperator.Nilike
];

/** Comparison + membership + null — legal on every scalar type. */
const COMPARABLE_OPERATORS: readonly FilterOperator[] = [
    FilterOperator.Eq,
    FilterOperator.Ne,
    FilterOperator.Gt,
    FilterOperator.Gte,
    FilterOperator.Lt,
    FilterOperator.Lte,
    FilterOperator.In,
    FilterOperator.Nin,
    FilterOperator.Null
];

/** {@link COMPARABLE_OPERATORS} plus the text-only `~~` family. */
const TEXT_OPERATORS: readonly FilterOperator[] = [
    ...COMPARABLE_OPERATORS,
    ...PATTERN_OPERATORS
];

/**
 * Operators offered per declared scalar type. See the note above for why this
 * is wider than the admin's picker table.
 *
 * `enum` is text-backed (a `select` field is a `text` column), so the pattern
 * operators are legal SQL on it — and unreachable in practice anyway, since
 * value coercion already requires an exact `enumValues` member. Listing them
 * keeps this table a statement about the **column**, which is what it is for.
 */
export const OPERATORS_BY_TYPE: Record<
    ScalarFieldType,
    readonly FilterOperator[]
> = {
    [ScalarFieldType.String]: TEXT_OPERATORS,
    [ScalarFieldType.Enum]: TEXT_OPERATORS,
    [ScalarFieldType.Number]: COMPARABLE_OPERATORS,
    [ScalarFieldType.Boolean]: COMPARABLE_OPERATORS,
    [ScalarFieldType.Uuid]: COMPARABLE_OPERATORS,
    [ScalarFieldType.Date]: COMPARABLE_OPERATORS
};

/**
 * The operators `type` accepts, or `undefined` when the type is not one this
 * table knows.
 *
 * `Object.hasOwn`, not a bare lookup: `OPERATORS_BY_TYPE` is a plain object
 * literal and a `FilterSchema` can be built at runtime (the content plugin
 * derives one per content type), so a field declaring `type: 'constructor'`
 * would otherwise read back a truthy non-array. An unknown type is reported by
 * `scalarOf`'s `FilterSchemaException` — a schema bug, a 500 — so this returns
 * `undefined` and lets the operator check stand aside rather than blame the
 * client for it.
 */
export function operatorsFor(
    type: ScalarFieldType
): readonly FilterOperator[] | undefined {
    return Object.hasOwn(OPERATORS_BY_TYPE, type)
        ? OPERATORS_BY_TYPE[type]
        : undefined;
}
