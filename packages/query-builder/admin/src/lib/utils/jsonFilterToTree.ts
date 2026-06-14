import {
    COMBINATOR,
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
 * Parse the JSON string stored under the `?filter=` query param back
 * into a {@link FilterGroup}. Returns `null` when the param is missing
 * or empty; returns `null` (rather than throwing) on malformed JSON so
 * a stale or hand-edited URL doesn't blow up the page.
 *
 * Only the JSON tree shape produced by {@link treeToJsonFilter} is
 * recognised. The bracket grammar is no longer accepted on the FE — by
 * the time a URL gets here it has already been written by this package.
 *
 * `idFactory` is exposed so unit tests can pin the React-key ids.
 */
export function jsonFilterToTree(
    params: URLSearchParams,
    idFactory: () => string = newId
): FilterGroup | null {
    const raw = params.get('filter');
    if (!raw) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
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
        const s = typeof raw === 'string' ? raw : String(raw ?? '');
        return s.replace(/^%|%$/g, '');
    }
    return typeof raw === 'string' ? raw : String(raw ?? '');
}

function isGroup(n: FilterGroup | FilterRule): n is FilterGroup {
    return 'children' in n;
}
