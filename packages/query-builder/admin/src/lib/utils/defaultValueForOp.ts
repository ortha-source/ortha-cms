import {
    OP,
    WITHIN_UNIT,
    type OpId,
    type RuleValue
} from '../types/filter-tree.type';

/**
 * Initial value to seed a rule with when its operator changes. Compound
 * ops (`between`, `within_last`, `is_one_of`) need a structured value
 * shape — leaving `''` there breaks the value editor (controlled →
 * uncontrolled inputs), serialises into a malformed wire payload (e.g.
 * `gte` with `value: undefined`) and, for `within_last`, throws
 * `RangeError` from `new Date(NaN)` on Apply.
 *
 * Scalar ops fall back to `''` so the existing `<Input>` editors stay
 * controlled from the first render.
 */
export function defaultValueForOp(op: OpId): RuleValue {
    switch (op) {
        case OP.Between:
            return { from: '', to: '' };
        case OP.WithinLast:
            return { n: 7, unit: WITHIN_UNIT.Days };
        case OP.IsOneOf:
            return [];
        case OP.IsEmpty:
            return null;
        default:
            return '';
    }
}
