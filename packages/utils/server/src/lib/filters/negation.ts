import { FilterOperator } from './types';
import type { ParsedFilter } from './types';

/**
 * Whether a leaf asks for the ABSENCE of a match rather than the presence
 * of one. `null` is operator-and-value dependent: `value: true` is
 * "is empty" (negating), `value: false` is "is not empty" (positive).
 */
export function isNegatingLeaf(op: FilterOperator, value: unknown): boolean {
    switch (op) {
        case FilterOperator.Ne:
        case FilterOperator.Nin:
        case FilterOperator.Nilike:
            return true;
        case FilterOperator.Null:
            return value === true;
        default:
            return false;
    }
}

/**
 * The positive twin of a negating leaf — the predicate whose *absence*
 * the original asserts. `ne`→`eq`, `nin`→`in`, `nilike`→`ilike`, and
 * "is empty"→"is not empty".
 *
 * Used to rewrite a negating rule on a RELATION path from
 * `EXISTS(… NOT p …)` into `NOT EXISTS(… p …)`. The two are not the same
 * statement once a relation can hold more than one row:
 *
 * - `tags.name is-none-of ['x']` as `EXISTS(tag WHERE name <> 'x')` means
 *   "has SOME tag that isn't x" — an entry tagged `[x, y]` matches, which
 *   is the opposite of what the filter says. As
 *   `NOT EXISTS(tag WHERE name = 'x')` it means "has NO tag named x". ✔
 * - `author.id is-empty` as `EXISTS(author WHERE author.id IS NULL)` can
 *   never be true (`id` is a NOT NULL primary key) — a dead filter. As
 *   `NOT EXISTS(author WHERE author.id IS NOT NULL)` it means "has no
 *   author". ✔
 *
 * For a to-ONE relation the rewrite also reads correctly and, as a bonus,
 * stops silently dropping rows whose FK is null: "author is not Ada" now
 * includes entries with no author at all, matching the same rule's
 * behaviour on a plain column (see `scalar()`'s null handling).
 */
export function positiveLeaf(leaf: ParsedFilter): ParsedFilter {
    switch (leaf.op) {
        case FilterOperator.Ne:
            return { ...leaf, op: FilterOperator.Eq };
        case FilterOperator.Nin:
            return { ...leaf, op: FilterOperator.In };
        case FilterOperator.Nilike:
            return { ...leaf, op: FilterOperator.Ilike };
        case FilterOperator.Null:
            return { ...leaf, op: FilterOperator.Null, value: false };
        default:
            return leaf;
    }
}
