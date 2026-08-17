import {
    FilterErrorCode,
    FilterException,
    FilterSchemaException
} from './filter-exceptions';
import { own } from './own-property';
import { FilterOperator, ScalarFieldType } from './types';
import type { FilterSchema, ParsedFilter, ScalarFieldSchema } from './types';

const OPS: readonly FilterOperator[] = Object.values(FilterOperator);

/** Canonical 8-4-4-4-12 hex UUID — what Postgres' `uuid` type actually accepts. */
const UUID_CANONICAL =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Walk a single dotted path against the schema, validate the operator,
 * and coerce the value to the declared type. Produces the `ParsedFilter`
 * leaf shape the tree parser tags with `kind: 'rule'`.
 */
export function resolveLeaf(
    path: string[],
    op: string,
    value: unknown,
    schema: FilterSchema,
    maxDepth: number,
    maxInListLength: number
): ParsedFilter {
    if (path.length === 0) {
        throw new FilterException(
            FilterErrorCode.EmptyPath,
            'empty filter path'
        );
    }
    if (path.length > maxDepth) {
        throw new FilterException(
            FilterErrorCode.DepthExceeded,
            `filter path exceeds max depth ${maxDepth}`,
            { path: path.join('.'), maxDepth }
        );
    }
    if (!OPS.includes(op as FilterOperator)) {
        throw new FilterException(
            FilterErrorCode.UnknownOperator,
            `unknown operator "${op}"`,
            { op }
        );
    }

    let fields = schema.fields ?? {};
    let relations = schema.relations ?? {};

    for (let i = 0; i < path.length; i++) {
        const seg = path[i];
        const last = i === path.length - 1;
        if (last) {
            const field = own(fields, seg);
            if (!field) {
                throw new FilterException(
                    FilterErrorCode.UnknownField,
                    `unknown field "${path.join('.')}"`,
                    { path: path.join('.') }
                );
            }
            return {
                path,
                op: op as FilterOperator,
                value: coerce(
                    value,
                    field,
                    op as FilterOperator,
                    path,
                    maxInListLength
                )
            };
        }
        const rel = own(relations, seg);
        if (!rel) {
            throw new FilterException(
                FilterErrorCode.UnknownRelation,
                `unknown relation "${seg}" in "${path.join('.')}"`,
                { segment: seg, path: path.join('.') }
            );
        }
        fields = rel.fields ?? {};
        relations = rel.relations ?? {};
    }

    throw new FilterException(
        FilterErrorCode.InvalidShape,
        'unreachable: path walker ended without a leaf'
    );
}

function coerce(
    raw: unknown,
    field: ScalarFieldSchema,
    op: FilterOperator,
    path: string[],
    maxInListLength: number
): unknown {
    const pathStr = path.join('.');
    if (op === FilterOperator.Null) {
        if (raw === 'true' || raw === true) return true;
        if (raw === 'false' || raw === false) return false;
        throw new FilterException(
            FilterErrorCode.InvalidValue,
            'null filter accepts only true|false',
            { path: pathStr, op, value: raw }
        );
    }
    if (op === FilterOperator.In || op === FilterOperator.Nin) {
        const items = Array.isArray(raw)
            ? raw
            : typeof raw === 'string'
              ? raw.split(',')
              : [raw];
        // An empty list would translate to `IN ()` / `NOT IN ()`, which
        // Drizzle emits as `false` / `true` — a silent no-op (matches
        // nothing) or inverted filter (matches everything). Reject it so
        // the client gets a clean 400 instead of a surprising result set.
        if (items.length === 0) {
            throw new FilterException(
                FilterErrorCode.EmptyInList,
                `${op} requires at least one value`,
                { path: pathStr, op }
            );
        }
        // Cap the list so a single rule (one node, under maxNodes) can't
        // blow up into an arbitrarily large IN clause.
        if (items.length > maxInListLength) {
            throw new FilterException(
                FilterErrorCode.MaxInListExceeded,
                `${op} value list exceeds max length ${maxInListLength}`,
                { path: pathStr, op, maxInListLength, length: items.length }
            );
        }
        return items.map((v) => scalarOf(v, field, pathStr));
    }
    return scalarOf(raw, field, pathStr);
}

function scalarOf(
    v: unknown,
    field: ScalarFieldSchema,
    pathStr: string
): unknown {
    // A filter value has to be a scalar. `String(v)` on anything else produces
    // a plausible-looking string that is then MATCHED AGAINST rather than
    // rejected: `null` → `"null"`, a missing `value` key → `"undefined"`,
    // `{}` → `"[object Object]"`, `[1,2]` → `"1,2"`, and (for a number field)
    // `[]` → `""` → `0`. Each returns 200 with a wrong, usually empty, result
    // set that the client reads as "no matches" instead of "bad request" —
    // the one silent failure mode in a library that 400s every other bad
    // value. A JSON client meaning "is null" wants the `null` operator.
    if (
        v === null ||
        (typeof v !== 'string' &&
            typeof v !== 'number' &&
            typeof v !== 'boolean')
    ) {
        throw new FilterException(
            FilterErrorCode.InvalidValue,
            v === undefined
                ? 'value is required'
                : 'value must be a string, number or boolean',
            { path: pathStr, expectedType: field.type }
        );
    }
    const s = typeof v === 'string' ? v : String(v);
    switch (field.type) {
        case ScalarFieldType.String:
            return s;
        case ScalarFieldType.Number: {
            const n = Number(s);
            if (!Number.isFinite(n)) {
                throw new FilterException(
                    FilterErrorCode.InvalidValue,
                    `not a number: ${s}`,
                    { path: pathStr, expectedType: 'number', value: s }
                );
            }
            return n;
        }
        case ScalarFieldType.Boolean:
            if (s === 'true') return true;
            if (s === 'false') return false;
            throw new FilterException(
                FilterErrorCode.InvalidValue,
                `not a boolean: ${s}`,
                { path: pathStr, expectedType: 'boolean', value: s }
            );
        case ScalarFieldType.Uuid:
            // Canonical 8-4-4-4-12 form — stricter than a loose `[0-9a-f-]{36}`,
            // which would let malformed values (e.g. 36 dashes) pass coercion
            // and then fail Postgres' uuid cast as a 500 instead of a clean 400.
            if (!UUID_CANONICAL.test(s)) {
                throw new FilterException(
                    FilterErrorCode.InvalidValue,
                    `not a uuid: ${s}`,
                    { path: pathStr, expectedType: 'uuid', value: s }
                );
            }
            return s;
        case ScalarFieldType.Date: {
            const d = new Date(s);
            if (Number.isNaN(d.getTime())) {
                throw new FilterException(
                    FilterErrorCode.InvalidValue,
                    `not a date: ${s}`,
                    { path: pathStr, expectedType: 'date', value: s }
                );
            }
            return d;
        }
        case ScalarFieldType.Enum:
            if (!field.enumValues?.includes(s)) {
                throw new FilterException(
                    FilterErrorCode.InvalidValue,
                    `not in enum: ${s}`,
                    {
                        path: pathStr,
                        expectedType: 'enum',
                        value: s,
                        allowed: field.enumValues
                    }
                );
            }
            return s;
        default:
            // Not reachable through the type system, but a schema built at
            // runtime (the content plugin derives one per content type) can
            // land here with an unrecognised `type`. Falling out of the switch
            // returned `undefined`, which drizzle renders as the same broken
            // `$1 = ` fragment an inherited field name used to produce.
            throw new FilterSchemaException(
                `field "${pathStr}" declares unknown type "${String(field.type)}"`
            );
    }
}
