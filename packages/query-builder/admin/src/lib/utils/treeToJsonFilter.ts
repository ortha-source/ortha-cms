import {
    COMBINATOR,
    isRule,
    OP,
    WITHIN_UNIT,
    type FilterGroup,
    type FilterRule,
    type RuleValue,
    type WithinUnit
} from '../types/filter-tree.type';
import { isRuleComplete } from './isRuleComplete';
import { UI_TO_WIRE, WIRE_OP, type WireOp } from './wireOp';

/**
 * Wire-format JSON node accepted by the BE `parseFilterTree`. Either a
 * group with a single combinator key (`and` / `or`) or a leaf rule.
 */
export type JsonFilterNode =
    | { and: JsonFilterNode[] }
    | { or: JsonFilterNode[] }
    | { field: string; op: WireOp; value: unknown };

/**
 * Serialise a {@link FilterGroup} into the BE-native JSON tree shape.
 * Returns the JSON string (ready to drop into a `?filter=` query param)
 * or `null` when the tree has no rules. `now` is injected so unit tests
 * can pin the cutoff for `within_last`, and so callers generating
 * shareable deep links can capture a stable instant.
 *
 * Operators that don't have a single wire op map to a small AND group:
 * `between` → `{ and: [{op:'gte'}, {op:'lte'}] }`. `within_last` resolves
 * to a concrete ISO `gte` cutoff at serialise time — same trade-off as
 * the bracket serialiser (intentional: deep links pin the instant).
 */
export function treeToJsonFilter(
    tree: FilterGroup | null,
    now: Date = new Date()
): string | null {
    const node = treeToJsonNode(tree, now);
    return node ? JSON.stringify(node) : null;
}

/**
 * Same shape as {@link treeToJsonFilter} but returns the underlying
 * node object instead of a JSON string. Useful for previews where the
 * caller wants to pretty-print or otherwise inspect the wire tree
 * before serialising it onto a URL.
 */
export function treeToJsonNode(
    tree: FilterGroup | null,
    now: Date = new Date()
): JsonFilterNode | null {
    if (!tree || tree.children.length === 0) return null;
    return serialise(tree, now);
}

/**
 * Recursively serialise a node, returning `null` when the node has no
 * usable contribution to the wire payload:
 *
 * - A rule whose value is incomplete (e.g. `actorId equals` with no
 *   value yet) drops out so the BE doesn't 400 on type coercion.
 * - A group whose children all dropped out also drops, so a sub-group
 *   the user added but never filled doesn't ship as `{or:[]}` (the BE
 *   rejects empty groups with FILTER_INVALID_NODE).
 */
function serialise(
    n: FilterGroup | FilterRule,
    now: Date
): JsonFilterNode | null {
    if (isRule(n)) return isRuleComplete(n) ? ruleToJson(n, now) : null;
    const children = n.children
        .map((c) => serialise(c, now))
        .filter((c): c is JsonFilterNode => c !== null);
    if (children.length === 0) return null;
    return { [n.combinator]: children } as JsonFilterNode;
}

function ruleToJson(rule: FilterRule, now: Date): JsonFilterNode {
    const f = rule.fieldId;
    switch (rule.op) {
        case OP.Contains:
            return {
                field: f,
                op: WIRE_OP.Ilike,
                value: `%${scalar(rule.value)}%`
            };
        case OP.IsOneOf:
            return {
                field: f,
                op: WIRE_OP.In,
                value: Array.isArray(rule.value) ? rule.value : []
            };
        case OP.IsEmpty:
            return { field: f, op: WIRE_OP.Null, value: true };
        case OP.Between: {
            const v = rule.value as { from: string; to: string };
            return {
                [COMBINATOR.And]: [
                    { field: f, op: WIRE_OP.Gte, value: v.from },
                    { field: f, op: WIRE_OP.Lte, value: v.to }
                ]
            } as JsonFilterNode;
        }
        case OP.WithinLast: {
            const v = rule.value as { n: number; unit: WithinUnit };
            const cutoff = new Date(
                now.getTime() - msFor(v.n, v.unit)
            ).toISOString();
            return { field: f, op: WIRE_OP.Gte, value: cutoff };
        }
        default: {
            const wire = UI_TO_WIRE[rule.op];
            if (!wire) {
                // Unreachable: every OpId is either a compound op handled
                // above or has a UI_TO_WIRE entry. The throw exists so a
                // future op added without an entry surfaces loudly.
                throw new Error(`no wire op for ${rule.op}`);
            }
            return { field: f, op: wire, value: scalar(rule.value) };
        }
    }
}

function scalar(v: RuleValue): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return String(v);
}

const MS_PER_UNIT: Record<WithinUnit, number> = {
    [WITHIN_UNIT.Minutes]: 60_000,
    [WITHIN_UNIT.Hours]: 60 * 60_000,
    [WITHIN_UNIT.Days]: 24 * 60 * 60_000
};

function msFor(n: number, unit: WithinUnit): number {
    return MS_PER_UNIT[unit] * n;
}
