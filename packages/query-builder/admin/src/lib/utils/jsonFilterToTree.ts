import {
    COMBINATOR,
    isRule,
    OP,
    type Combinator,
    type FilterGroup,
    type FilterRule,
    type OpId,
    type RuleValue
} from '../types/filter-tree.type';
import { newId } from './newId';
import { WIRE_TO_UI, type WireOp } from './wireOp';

/**
 * Parse the raw `?filter=` JSON string (e.g. `searchParams.get('filter')`)
 * back into a {@link FilterGroup}. Returns `null` when the value is missing
 * or empty; returns `null` (rather than throwing) on malformed JSON so a
 * stale or hand-edited URL doesn't blow up the page.
 *
 * Only the JSON tree shape produced by {@link treeToJsonFilter} is
 * recognised. The bracket grammar is no longer accepted on the FE — by
 * the time a URL gets here it has already been written by this package.
 *
 * `idFactory` is exposed so unit tests can pin the React-key ids.
 */
export function jsonFilterToTree(
    filter: string | null | undefined,
    idFactory: () => string = newId
): FilterGroup | null {
    if (!filter) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(filter);
    } catch {
        return null;
    }

    const node = walk(parsed, idFactory);
    if (!node) return null;
    if (isGroup(node)) return node;
    // Single-rule root — wrap in an AND group so the FE state always
    // holds a group at the top.
    return {
        id: idFactory(),
        combinator: COMBINATOR.And,
        children: [node]
    };
}

function walk(
    raw: unknown,
    idFactory: () => string
): FilterGroup | FilterRule | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;

    if (COMBINATOR.And in obj || COMBINATOR.Or in obj) {
        const combinator: Combinator =
            COMBINATOR.And in obj ? COMBINATOR.And : COMBINATOR.Or;
        const children = obj[combinator];
        if (!Array.isArray(children)) return null;
        const mapped = children
            .map((c) => walk(c, idFactory))
            .filter((c): c is FilterGroup | FilterRule => c !== null);
        if (mapped.length === 0) return null;
        // Collapse the `{and:[gte, lte]}` shape `treeToJsonFilter` emits for a
        // `between` rule back into a single Between rule, so a saved range
        // round-trips to its compound editor instead of two loose Gte/Lte rows
        // (which would also double-count in the "Filters (N)" badge).
        if (combinator === COMBINATOR.And && mapped.length === 2) {
            const between = pairToBetween(mapped[0], mapped[1], idFactory);
            if (between) return between;
        }
        return {
            id: idFactory(),
            combinator,
            children: mapped
        };
    }

    if (typeof obj.field === 'string' && typeof obj.op === 'string') {
        const op = wireOpToUiOp(obj.op as WireOp);
        if (!op) return null;
        // `null` op carries truthy `value:true` — `value:false` would
        // mean "is not null" which the FE has no UI for, so drop it
        // rather than silently rehydrate as `is_empty`.
        if (op === OP.IsEmpty && obj.value === false) return null;
        return {
            id: idFactory(),
            fieldId: obj.field,
            op,
            value: valueFor(op, obj.value)
        };
    }

    return null;
}

function wireOpToUiOp(wireOp: string): OpId | null {
    return WIRE_TO_UI[wireOp as WireOp] ?? null;
}

function valueFor(op: OpId, raw: unknown): RuleValue {
    if (op === OP.IsEmpty) return null;
    if (op === OP.IsOneOf) return Array.isArray(raw) ? (raw as string[]) : [];
    if (op === OP.Contains) {
        // Inverse of treeToJsonFilter's `%${escapeLike(v)}%`: drop the wrapping
        // wildcards, then unescape `\%` / `\_` / `\\` back to the literal text
        // the user typed, so a value containing `%`/`_` round-trips faithfully.
        const s = typeof raw === 'string' ? raw : String(raw ?? '');
        return unescapeLike(s.replace(/^%|%$/g, ''));
    }
    return typeof raw === 'string' ? raw : String(raw ?? '');
}

/** Inverse of `escapeLike`: `\%` → `%`, `\_` → `_`, `\\` → `\`. */
function unescapeLike(s: string): string {
    return s.replace(/\\([\\%_])/g, '$1');
}

function isGroup(n: FilterGroup | FilterRule): n is FilterGroup {
    return 'children' in n;
}

/**
 * If two sibling nodes are a `gte` + `lte` pair of rules on the same field,
 * fold them into one Between rule (the inverse of `treeToJsonFilter`'s
 * `between` serialisation). Returns `null` for any other pair, so a genuine
 * two-rule AND group is left untouched.
 */
function pairToBetween(
    a: FilterGroup | FilterRule,
    b: FilterGroup | FilterRule,
    idFactory: () => string
): FilterRule | null {
    if (!isRule(a) || !isRule(b)) return null;
    if (a.fieldId !== b.fieldId) return null;
    const gte = a.op === OP.Gte ? a : b.op === OP.Gte ? b : null;
    const lte = a.op === OP.Lte ? a : b.op === OP.Lte ? b : null;
    if (!gte || !lte || gte === lte) return null;
    if (typeof gte.value !== 'string' || typeof lte.value !== 'string') {
        return null;
    }
    return {
        id: idFactory(),
        fieldId: a.fieldId,
        op: OP.Between,
        value: { from: gte.value, to: lte.value }
    };
}
