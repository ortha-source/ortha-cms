/**
 * The first path segment of every leaf in a query-builder filter tree.
 *
 * `{"and":[{"field":"author.status",…},{"field":"status",…}]}` yields
 * `{"author", "status"}` — the relation names a rule traverses, plus its own
 * scalar field names, which are harmless because they never collide with a
 * relation (content's `assertFields` rejects a field that shadows a relation's
 * column).
 *
 * This is what makes the reverse pass possible: when an author is published,
 * the rules that might care are exactly those whose trees mention a relation
 * pointing at authors, and finding them is a walk over a small JSON document
 * rather than a jsonb query this table has no index for.
 *
 * Pure and framework-free so it can be unit-tested against the shapes the query
 * builder actually emits — which is the only reason it is not a private helper
 * in the repository.
 */
export function filterTreeSegments(filter: unknown): Set<string> {
    const segments = new Set<string>();
    visit(filter, segments, 0);
    return segments;
}

/**
 * A stored tree is data, and data can be malformed or adversarially deep — a
 * rule row could be hand-edited, or restored from a backup taken across a
 * schema change. The depth cap keeps a walk over one bounded rather than
 * trusting the tree to terminate.
 */
const MAX_DEPTH = 16;

function visit(node: unknown, into: Set<string>, depth: number): void {
    if (depth > MAX_DEPTH || !node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    for (const combinator of ['and', 'or'] as const) {
        const children = obj[combinator];
        if (Array.isArray(children)) {
            for (const child of children) visit(child, into, depth + 1);
            return;
        }
    }

    const field = obj['field'];
    if (typeof field === 'string' && field.length > 0) {
        into.add(field.split('.')[0]);
    }
}
