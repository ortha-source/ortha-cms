/**
 * Client-side evaluator for a query-builder {@link FilterGroup} against a single
 * record. Mirrors (loosely) what `parseFilterTree` in `@ortha-cms/utils-server`
 * does on the server, but in the browser — so the **mocked** relation-candidate
 * list (see `useRelationCandidates`) can be narrowed by the same query-builder
 * tree the user composes in the picker. When the relation read API lands this
 * goes away: the server will run the filter and this file is deleted.
 *
 * Semantics match the builder's grammar (`OP` / `COMBINATOR`): a group ANDs/ORs
 * its children; an empty group imposes no constraint; an incomplete rule (no
 * value, where the operator needs one) is a no-op (passes) rather than matching
 * nothing — the same forgiving stance the drawer takes when it prunes drafts.
 */

import {
    COMBINATOR,
    OP,
    isRule,
    type FilterField,
    type FilterGroup,
    type FilterRule
} from '@ortha-cms/query-builder-admin';

/** A record as the evaluator sees it: a values bag plus the optional status. */
export type EvaluableRecord = {
    status?: string;
    values: Record<string, unknown>;
};

/** The raw cell value a `fieldId` resolves to (status is an envelope column). */
function cellValue(record: EvaluableRecord, fieldId: string): unknown {
    return fieldId === 'status' ? record.status : record.values[fieldId];
}

/** Empty test shared with the server's `isEmptyFieldValue`. */
function isEmpty(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}

/** Lower-cased string view of a value, for case-insensitive text comparison. */
function asText(value: unknown): string {
    return value == null ? '' : String(value).toLowerCase();
}

/** Numeric view (number column, or a date parsed to epoch ms), or NaN. */
function asNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    const asDate = Date.parse(String(value));
    if (!Number.isNaN(asDate)) return asDate;
    return Number(value);
}

/** Whether one rule holds for a record. Unknown/incomplete rules pass. */
function evalRule(record: EvaluableRecord, rule: FilterRule): boolean {
    const cell = cellValue(record, rule.fieldId);
    const { op, value } = rule;

    if (op === OP.IsEmpty) return isEmpty(cell);

    // An incomplete rule (no value for an operator that needs one) is a no-op.
    if (isEmpty(value as unknown)) return true;

    switch (op) {
        case OP.Equals:
            return asText(cell) === asText(value);
        case OP.NotEquals:
            return asText(cell) !== asText(value);
        case OP.Contains:
            return asText(cell).includes(asText(value));
        case OP.IsOneOf:
            return (
                Array.isArray(value) &&
                value.map((v) => v.toLowerCase()).includes(asText(cell))
            );
        case OP.Gt:
            return asNumber(cell) > asNumber(value);
        case OP.Gte:
            return asNumber(cell) >= asNumber(value);
        case OP.Lt:
            return asNumber(cell) < asNumber(value);
        case OP.Lte:
            return asNumber(cell) <= asNumber(value);
        case OP.Between: {
            const range = value as { from: string; to: string };
            const n = asNumber(cell);
            return n >= asNumber(range.from) && n <= asNumber(range.to);
        }
        case OP.WithinLast: {
            const { n, unit } = value as { n: number; unit: string };
            const ms =
                n *
                (unit === 'minutes'
                    ? 60_000
                    : unit === 'hours'
                      ? 3_600_000
                      : 86_400_000);
            return asNumber(cell) >= Date.now() - ms;
        }
        default:
            return true;
    }
}

/** Whether a (possibly nested) group holds for a record. */
function evalGroup(record: EvaluableRecord, group: FilterGroup): boolean {
    if (group.children.length === 0) return true;
    const results = group.children.map((child) =>
        isRule(child) ? evalRule(record, child) : evalGroup(record, child)
    );
    return group.combinator === COMBINATOR.Or
        ? results.some(Boolean)
        : results.every(Boolean);
}

/**
 * Whether `record` satisfies the filter `tree`. A `null` tree (no rules) matches
 * everything. `fields` is accepted for symmetry with the server signature and
 * future type-aware coercion; the current evaluator infers types from values.
 */
export function matchesFilterTree(
    record: EvaluableRecord,
    tree: FilterGroup | null,
    _fields: readonly FilterField[] = []
): boolean {
    if (!tree) return true;
    return evalGroup(record, tree);
}
