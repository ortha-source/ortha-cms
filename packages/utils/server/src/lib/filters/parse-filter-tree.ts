import {
    DEFAULT_MAX_DEPTH,
    DEFAULT_MAX_GROUP_DEPTH,
    DEFAULT_MAX_IN_LIST,
    DEFAULT_MAX_NODES,
    DEFAULT_MAX_VALUE_LENGTH
} from './budgets';
import { FilterErrorCode, FilterException } from './filter-exceptions';
import { resolveLeaf } from './resolve-leaf';
import type { FilterSchema, ParsedFilter, ParsedNode } from './types';

/**
 * Parse a `filter` payload into a tree the translator can walk. Two
 * input shapes are accepted:
 *
 * 1. `string` — a JSON-encoded tree, so a controller can forward
 *    `?filter=<json>` without pre-parsing. Throws `InvalidJson` on
 *    malformed input.
 * 2. Object — already-parsed tree (`{ and: [...] }` / `{ or: [...] }` /
 *    single rule `{ field, op, value }`). Recursively validated; each
 *    leaf flows through the same schema/op/coercion check.
 *
 * Returns `null` when the input is missing, empty, or `{}` so callers
 * can skip the WHERE clause without an empty-array dance.
 */
export function parseFilterTree(
    rawFilter: unknown,
    schema: FilterSchema
): ParsedNode | null {
    if (rawFilter === undefined || rawFilter === null) return null;

    let value: unknown = rawFilter;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) return null;
        try {
            value = JSON.parse(trimmed);
        } catch (err) {
            throw new FilterException(
                FilterErrorCode.InvalidJson,
                'filter string is not valid JSON',
                { reason: (err as Error).message }
            );
        }
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new FilterException(
            FilterErrorCode.InvalidShape,
            'expected object'
        );
    }

    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return null;

    const ctx: WalkContext = {
        nodeCount: 0,
        maxNodes: schema.maxNodes ?? DEFAULT_MAX_NODES,
        maxGroupDepth: schema.maxGroupDepth ?? DEFAULT_MAX_GROUP_DEPTH,
        maxDepth: schema.maxDepth ?? DEFAULT_MAX_DEPTH,
        maxInListLength: schema.maxInListLength ?? DEFAULT_MAX_IN_LIST,
        maxValueLength: schema.maxValueLength ?? DEFAULT_MAX_VALUE_LENGTH
    };
    return walkNode(obj, schema, 0, ctx);
}

interface WalkContext {
    nodeCount: number;
    maxNodes: number;
    maxGroupDepth: number;
    maxDepth: number;
    maxInListLength: number;
    maxValueLength: number;
}

function walkNode(
    raw: unknown,
    schema: FilterSchema,
    depth: number,
    ctx: WalkContext
): ParsedNode {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new FilterException(
            FilterErrorCode.InvalidNode,
            'tree node must be an object'
        );
    }
    ctx.nodeCount += 1;
    if (ctx.nodeCount > ctx.maxNodes) {
        throw new FilterException(
            FilterErrorCode.MaxNodesExceeded,
            `filter exceeds max node count ${ctx.maxNodes}`,
            { maxNodes: ctx.maxNodes }
        );
    }

    const node = raw as Record<string, unknown>;
    // `Object.hasOwn`, not `in`: `parseFilterTree` also accepts an
    // already-parsed object, which a caller could hand over with a prototype
    // that carries these names. Shape detection must read what the payload
    // itself declares.
    const isAnd = Object.hasOwn(node, 'and');
    const isOr = Object.hasOwn(node, 'or');

    if (isAnd && isOr) {
        throw new FilterException(
            FilterErrorCode.InvalidNode,
            'group node must declare exactly one of `and` or `or`'
        );
    }

    if (isAnd || isOr) {
        if (depth >= ctx.maxGroupDepth) {
            throw new FilterException(
                FilterErrorCode.GroupDepthExceeded,
                `group nesting exceeds max depth ${ctx.maxGroupDepth}`,
                { maxGroupDepth: ctx.maxGroupDepth }
            );
        }
        const combinator: 'and' | 'or' = isAnd ? 'and' : 'or';
        const children = node[combinator];
        if (!Array.isArray(children)) {
            throw new FilterException(
                FilterErrorCode.InvalidNode,
                `\`${combinator}\` must be an array of nodes`
            );
        }
        if (children.length === 0) {
            throw new FilterException(
                FilterErrorCode.InvalidNode,
                `\`${combinator}\` group must contain at least one child`
            );
        }
        return {
            kind: 'group',
            combinator,
            children: children.map((c) => walkNode(c, schema, depth + 1, ctx))
        };
    }

    if (Object.hasOwn(node, 'field') && Object.hasOwn(node, 'op')) {
        const field = node.field;
        const op = node.op;
        if (typeof field !== 'string' || field.length === 0) {
            throw new FilterException(
                FilterErrorCode.InvalidNode,
                'rule `field` must be a non-empty string'
            );
        }
        if (typeof op !== 'string' || op.length === 0) {
            throw new FilterException(
                FilterErrorCode.InvalidNode,
                'rule `op` must be a non-empty string'
            );
        }
        const path = field.split('.');
        const leaf = resolveLeaf(path, op, node.value, schema, ctx);
        return toRule(leaf);
    }

    throw new FilterException(
        FilterErrorCode.InvalidNode,
        'tree node must have `and`, `or`, or (`field` + `op`)'
    );
}

function toRule(leaf: ParsedFilter): ParsedNode {
    return { kind: 'rule', ...leaf };
}
