import { and, not, or, type SQL } from 'drizzle-orm';
import { FilterErrorCode, FilterException } from './filter-exceptions';
import { isNegatingLeaf, positiveLeaf } from './negation';
import { relationExists } from './relation-exists';
import { scalar } from './scalar-op';
import { columnOf, type DbLike, type TableLike } from './table-helpers';
import type { FilterSchema, ParsedNode, ParsedRule } from './types';

export type { DbLike, TableLike } from './table-helpers';

/**
 * Hook a host can supply to handle filter rules whose field is in
 * {@link FilterSchema.extensionFields}. Returns a Drizzle SQL fragment
 * that gets spliced into the WHERE tree at the leaf's position, so
 * extension rules compose with native ones inside AND/OR groups.
 *
 * The translator awaits each call sequentially during the walk; if
 * an extension performs a DB roundtrip its latency adds linearly per
 * leaf — extensions that need expensive lookups should prepare data
 * once per request and capture it in the closure.
 */
export type FilterExtensionResolver = (rule: ParsedRule) => Promise<SQL>;

/** Optional translator hooks — currently just the extension resolver. */
export interface ApplyFilterTreeOptions {
    /** Called for any leaf whose `path[0]` is in `schema.extensionFields`. */
    resolveExtension?: FilterExtensionResolver;
}

/**
 * Translate a parsed filter tree into a single Drizzle SQL fragment.
 * Returns `undefined` when the tree is empty (or every group collapses
 * to nothing) so callers can skip the WHERE clause without a special
 * case. Group nodes emit `and(...)` / `or(...)`; rule nodes share the
 * same scalar / relation translation.
 *
 * Async because extension resolvers may be async (e.g. a role filter
 * runs a tiny `SELECT slug FROM roles` to validate enum membership).
 * Non-extension trees stay synchronous in spirit — every native branch
 * resolves immediately, no awaits hit the wire.
 */
export async function applyFilterTree(
    tree: ParsedNode | null | undefined,
    schema: FilterSchema,
    rootTable: TableLike,
    db: DbLike,
    options: ApplyFilterTreeOptions = {}
): Promise<SQL | undefined> {
    if (!tree) return undefined;
    return walk(tree, schema, rootTable, db, options);
}

async function walk(
    node: ParsedNode,
    schema: FilterSchema,
    parent: TableLike,
    db: DbLike,
    options: ApplyFilterTreeOptions
): Promise<SQL | undefined> {
    if (node.kind === 'rule') {
        return translateRule(node, schema, parent, db, options);
    }

    const parts: SQL[] = [];
    for (const child of node.children) {
        const piece = await walk(child, schema, parent, db, options);
        if (piece !== undefined) parts.push(piece);
    }
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return node.combinator === 'or' ? or(...parts)! : and(...parts)!;
}

async function translateRule(
    rule: ParsedRule,
    schema: FilterSchema,
    parent: TableLike,
    db: DbLike,
    options: ApplyFilterTreeOptions
): Promise<SQL> {
    const head = rule.path[0];
    if (schema.extensionFields?.has(head)) {
        if (!options.resolveExtension) {
            throw new FilterException(
                FilterErrorCode.InvalidNode,
                `extension field "${head}" referenced but no resolver provided`,
                { field: head }
            );
        }
        return options.resolveExtension(rule);
    }
    if (rule.path.length === 1) {
        return scalar(columnOf(parent, rule.path[0]), rule.op, rule.value);
    }
    const key = rule.path[0];
    const rel = schema.relations?.[key];
    if (!rel) {
        throw new FilterException(
            FilterErrorCode.UnknownRelation,
            `unknown relation "${key}"`,
            { relation: key }
        );
    }
    const leaf = { path: rule.path.slice(1), op: rule.op, value: rule.value };
    // A negating rule on a relation path asks for the ABSENCE of a matching
    // related row, which is `NOT EXISTS(… positive …)` — NOT the naive
    // `EXISTS(… negated …)`, which on a to-many relation asserts the
    // opposite of what the user wrote. The negation wraps the OUTERMOST
    // hop, so a multi-hop path negates the whole chain ("no (author,
    // company) pair matches") rather than just its last segment.
    if (isNegatingLeaf(rule.op, rule.value)) {
        return not(relationExists(rel, parent, positiveLeaf(leaf), db));
    }
    return relationExists(rel, parent, leaf, db);
}
