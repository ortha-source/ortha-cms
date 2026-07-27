import {
    FIELD_TYPE,
    type FieldType,
    type FilterField
} from '../types/filter-field.type';
import {
    isRule,
    OP,
    type FilterGroup,
    type FilterRule,
    type WithinUnit
} from '../types/filter-tree.type';

/**
 * Machine-readable validation outcome for one rule. UI maps this to a
 * localised message; the same code surfaces both server-equivalent
 * coercion failures (e.g. {@link RULE_VALIDATION.NotUuid}) and
 * UI-only completeness checks (e.g. {@link RULE_VALIDATION.ValueRequired}).
 */
export const RULE_VALIDATION = {
    /**
     * The rule's `fieldId` isn't in the offered fields — a filter restored
     * from a URL or a saved view after the field was renamed or removed.
     * Unlike the others this can't be fixed by editing the value; the user
     * has to re-pick the field (or drop the rule).
     */
    UnknownField: 'unknown_field',
    ValueRequired: 'value_required',
    NotUuid: 'not_uuid',
    NotNumber: 'not_number',
    NotDate: 'not_date',
    RangeRequired: 'range_required',
    RangeInvalid: 'range_invalid',
    MultiRequired: 'multi_required',
    CountRequired: 'count_required'
} as const;

/** One of the {@link RULE_VALIDATION} values. */
export type RuleValidationCode =
    (typeof RULE_VALIDATION)[keyof typeof RULE_VALIDATION];

/**
 * Validate a rule against its field. Returns `null` when the rule
 * would produce a wire-valid payload, or a {@link RuleValidationCode}
 * naming the first failure otherwise. Mirrors the BE coercion rules
 * in `resolve-leaf.ts` so a rule that passes here is one the server
 * accepts.
 *
 * `is_empty` is always valid (the operator carries the meaning).
 */
export function validateRule(
    rule: FilterRule,
    field: FilterField
): RuleValidationCode | null {
    if (rule.op === OP.IsEmpty || rule.op === OP.IsNotEmpty) return null;

    if (rule.op === OP.Between) {
        const v = rule.value as
            | { from?: string; to?: string }
            | null
            | undefined;
        if (!v || !v.from || !v.to) return RULE_VALIDATION.RangeRequired;
        if (!isScalarValid(v.from, field.type)) {
            return RULE_VALIDATION.RangeInvalid;
        }
        if (!isScalarValid(v.to, field.type)) {
            return RULE_VALIDATION.RangeInvalid;
        }
        return null;
    }

    if (rule.op === OP.WithinLast) {
        const v = rule.value as
            | { n?: number; unit?: WithinUnit }
            | null
            | undefined;
        if (!v || typeof v.n !== 'number' || v.n <= 0 || !v.unit) {
            return RULE_VALIDATION.CountRequired;
        }
        return null;
    }

    if (rule.op === OP.IsOneOf || rule.op === OP.NotOneOf) {
        if (!Array.isArray(rule.value) || rule.value.length === 0) {
            return RULE_VALIDATION.MultiRequired;
        }
        // Validate every item, not just presence — a free-text CSV editor
        // (string/uuid fields) can produce items the server rejects with
        // FILTER_INVALID_VALUE. Without this, e.g. a `uuid in (abc,def)`
        // rule passes the Apply gate and 400s on the wire.
        for (const item of rule.value) {
            if (typeof item !== 'string' || !isScalarValid(item, field.type)) {
                if (field.type === FIELD_TYPE.Uuid) {
                    return RULE_VALIDATION.NotUuid;
                }
                if (field.type === FIELD_TYPE.Number) {
                    return RULE_VALIDATION.NotNumber;
                }
                if (field.type === FIELD_TYPE.Date) {
                    return RULE_VALIDATION.NotDate;
                }
                return RULE_VALIDATION.MultiRequired;
            }
        }
        return null;
    }

    if (typeof rule.value !== 'string' || rule.value.length === 0) {
        return RULE_VALIDATION.ValueRequired;
    }
    if (!isScalarValid(rule.value, field.type)) {
        if (field.type === FIELD_TYPE.Uuid) return RULE_VALIDATION.NotUuid;
        if (field.type === FIELD_TYPE.Number) return RULE_VALIDATION.NotNumber;
        if (field.type === FIELD_TYPE.Date) return RULE_VALIDATION.NotDate;
        // string / boolean / enum are unconstrained beyond presence at
        // this layer — Select-driven editors enforce membership.
    }
    return null;
}

/**
 * Walk a tree and return `true` if any rule under it fails validation
 * — used by the drawer's Apply gate so a half-filled rule blocks
 * commit instead of round-tripping a 400 from the server.
 */
export function treeHasInvalidRules(
    tree: FilterGroup | null,
    fields: readonly FilterField[]
): boolean {
    if (!tree) return false;
    const fieldById = new Map(fields.map((f) => [f.id, f]));
    return walkInvalid(tree, fieldById);
}

function walkInvalid(
    node: FilterGroup | FilterRule,
    fieldById: Map<string, FilterField>
): boolean {
    if (isRule(node)) {
        const field = fieldById.get(node.fieldId);
        if (!field) return true;
        return validateRule(node, field) !== null;
    }
    return node.children.some((c) => walkInvalid(c, fieldById));
}

// Canonical 8-4-4-4-12 hex UUID format. Stricter than the BE's
// `[0-9a-f-]{36}` regex on purpose — Postgres' uuid type rejects
// anything that isn't this shape (e.g. all-dashes, hex without
// separators), so the BE-loose regex still produces a 400 from the
// driver. Validating against the canonical form here means a value
// that passes FE validation always passes both BE coercion *and*
// Postgres parsing.
const UUID_CANONICAL =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isScalarValid(s: string, type: FieldType): boolean {
    switch (type) {
        case FIELD_TYPE.Uuid:
            return UUID_CANONICAL.test(s);
        case FIELD_TYPE.Number:
            return Number.isFinite(Number(s));
        case FIELD_TYPE.Date:
            return !Number.isNaN(new Date(s).getTime());
        case FIELD_TYPE.Boolean:
            return s === 'true' || s === 'false';
        case FIELD_TYPE.String:
        case FIELD_TYPE.Enum:
            return true;
    }
}
