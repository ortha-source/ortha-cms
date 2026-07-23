import {
    OP,
    type FilterRule,
    type WithinUnit
} from '../types/filter-tree.type';

/**
 * Whether a rule has enough value to make a valid wire payload. The
 * serialiser ({@link treeToJsonFilter}) drops incomplete rules so a
 * half-filled draft (e.g. `actorId equals` with no value yet) doesn't
 * 400 the server with `FILTER_INVALID_VALUE`.
 *
 * Symmetric with the empty-group pruning already in `serialise()`:
 * the goal is "the wire payload is always well-formed; the user can
 * have draft rules in the drawer without committing them."
 */
export function isRuleComplete(rule: FilterRule): boolean {
    switch (rule.op) {
        case OP.IsEmpty:
        case OP.IsNotEmpty:
            // The operator carries the full meaning; no value needed.
            return true;
        case OP.Between: {
            const v = rule.value as
                | { from?: string; to?: string }
                | null
                | undefined;
            return Boolean(v && v.from && v.to);
        }
        case OP.WithinLast: {
            const v = rule.value as
                | { n?: number; unit?: WithinUnit }
                | null
                | undefined;
            return Boolean(v && typeof v.n === 'number' && v.n > 0 && v.unit);
        }
        case OP.IsOneOf:
        case OP.NotOneOf:
            return Array.isArray(rule.value) && rule.value.length > 0;
        default:
            return typeof rule.value === 'string' && rule.value.length > 0;
    }
}
