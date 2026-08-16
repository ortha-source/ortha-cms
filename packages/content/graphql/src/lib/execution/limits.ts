import {
    GraphQLError,
    Kind,
    type DocumentNode,
    type FragmentDefinitionNode,
    type OperationDefinitionNode,
    type SelectionSetNode,
    type ValueNode,
    type VariableDefinitionNode
} from 'graphql';
import type { ContentGraphqlLimits } from '../types/config';

/**
 * The cost budget an operation must fit inside, checked **after parsing and
 * before execution** — so a refused document costs a parse and nothing else.
 *
 * REST bounded a request structurally: one route, one page, `MAX_PAGE_SIZE`.
 * A GraphQL document has no such shape, and the three ways to make one
 * expensive are independent, which is why there are three limits rather than
 * one clever number:
 *
 * - **Depth** bounds the level-by-level loader, which issues a batch per level.
 * - **Complexity** bounds the rows those levels multiply out to. A depth cap
 *   alone lets `articles(pageSize: 100) { tags(pageSize: 100) { … } }` straight
 *   through.
 * - **Field count** bounds aliasing, which multiplies cost without ever
 *   nesting — `a: articles(…) b: articles(…) c: …` is depth 2 and complexity
 *   per-field, but a hundred of them is a hundred queries.
 *
 * ## The walk is linear in the document, not in its expansion
 *
 * Every walk below is memoised **per fragment name**, so a fragment spread ten
 * times costs one visit rather than ten sub-walks. Without that, a document of
 * a few hundred bytes — nine fragments each spreading the next ten times —
 * expands to 10⁹ visits and blocks the event loop for minutes, which takes the
 * whole process down rather than the one request. Memoising is sound because a
 * fragment's depth, field count and per-unit complexity do not depend on where
 * it was spread from.
 */

/** Every limit an operation broke, empty when it fits. */
export function checkLimits(
    document: DocumentNode,
    operationName: string | undefined,
    variables: Record<string, unknown>,
    limits: ContentGraphqlLimits
): GraphQLError[] {
    const operations = document.definitions.filter(
        (definition): definition is OperationDefinitionNode =>
            definition.kind === Kind.OPERATION_DEFINITION
    );
    // More than one operation per request multiplies every other budget, and
    // nothing legitimate needs it: a client sends the operation it wants to run.
    if (operations.length > 1 && !operationName) {
        return [
            new GraphQLError(
                'This endpoint runs one operation per request — name it with `operationName`, or send one operation.',
                { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
            )
        ];
    }
    const operation = operationName
        ? operations.find((node) => node.name?.value === operationName)
        : operations[0];
    if (!operation) {
        return [
            new GraphQLError(
                operationName
                    ? `No operation named "${operationName}" in this document.`
                    : 'The document defines no operation.',
                { extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }
            )
        ];
    }

    const fragments = fragmentsOf(document);
    if (hasFragmentCycle(fragments)) {
        // A cyclic document cannot execute: graphql-js's `NoFragmentCycles`
        // rule rejects it in the very next stage, with a better message than
        // anything invented here. Costing it would mean either an unbounded
        // walk or a memo whose entries were computed against a broken-off
        // cycle, so hand it straight to validation instead.
        return [];
    }

    const cost = new CostMemo();
    const errors: GraphQLError[] = [];

    const depth = cost.depth(operation.selectionSet, fragments);
    if (depth > limits.maxDepth) {
        errors.push(
            new GraphQLError(
                `Query is ${depth} levels deep; the limit is ${limits.maxDepth}. Split it, or fetch the deeper records in a second request.`,
                { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
            )
        );
    }

    const fields = cost.fields(operation.selectionSet, fragments);
    if (fields > limits.maxFields) {
        errors.push(
            new GraphQLError(
                `Query selects ${fields} fields; the limit is ${limits.maxFields}.`,
                { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
            )
        );
    }

    const sizes = pageSizesFor(operation, variables);
    const complexity = cost.complexity(operation.selectionSet, fragments, sizes);
    if (complexity > limits.maxComplexity) {
        errors.push(
            new GraphQLError(
                `Query may touch about ${complexity} records; the limit is ${limits.maxComplexity}. Lower a \`pageSize\`, or select fewer nested lists.`,
                { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
            )
        );
    }

    return errors;
}

/**
 * The three cost walks, each memoised per fragment name.
 *
 * One instance per `checkLimits` call: the memo is keyed on fragment name, and
 * two requests can send different fragments under the same name.
 */
class CostMemo {
    private readonly depths = new Map<string, number>();
    private readonly fieldCounts = new Map<string, number>();
    /** Complexity of a fragment at multiplier 1 — cost scales linearly. */
    private readonly complexities = new Map<string, number>();

    /** Deepest selection path, following fragments. */
    depth(
        selectionSet: SelectionSetNode,
        fragments: Fragments
    ): number {
        let deepest = 0;
        for (const selection of selectionSet.selections) {
            if (selection.kind === Kind.FIELD) {
                if (isIntrospection(selection.name.value)) {
                    continue;
                }
                const nested = selection.selectionSet
                    ? this.depth(selection.selectionSet, fragments)
                    : 0;
                deepest = Math.max(deepest, nested + 1);
                continue;
            }
            if (selection.kind === Kind.INLINE_FRAGMENT) {
                deepest = Math.max(
                    deepest,
                    this.depth(selection.selectionSet, fragments)
                );
                continue;
            }
            const fragment = fragments.get(selection.name.value);
            if (!fragment) {
                continue;
            }
            deepest = Math.max(
                deepest,
                memoised(this.depths, fragment.name.value, () =>
                    this.depth(fragment.selectionSet, fragments)
                )
            );
        }
        return deepest;
    }

    /** Total field selections in the operation, aliases included. */
    fields(selectionSet: SelectionSetNode, fragments: Fragments): number {
        let count = 0;
        for (const selection of selectionSet.selections) {
            if (selection.kind === Kind.FIELD) {
                if (isIntrospection(selection.name.value)) {
                    continue;
                }
                count += 1;
                if (selection.selectionSet) {
                    count += this.fields(selection.selectionSet, fragments);
                }
                continue;
            }
            if (selection.kind === Kind.INLINE_FRAGMENT) {
                count += this.fields(selection.selectionSet, fragments);
                continue;
            }
            const fragment = fragments.get(selection.name.value);
            if (!fragment) {
                continue;
            }
            count += memoised(this.fieldCounts, fragment.name.value, () =>
                this.fields(fragment.selectionSet, fragments)
            );
        }
        return count;
    }

    /**
     * Rough count of the records an operation could touch: each field's page
     * size multiplied down its nesting path, summed across siblings.
     *
     * An **estimate**, and deliberately a pessimistic one — it assumes every
     * list comes back full. That is the right bias for a budget: the point is
     * to refuse the shapes that *can* be enormous, and a query that would have
     * returned three rows is not the one straining the database.
     *
     * A field with no explicit page size counts as {@link ASSUMED_PAGE_SIZE}
     * rather than 1, because the server's own default is what it will actually
     * fetch.
     */
    complexity(
        selectionSet: SelectionSetNode,
        fragments: Fragments,
        sizes: PageSizes,
        multiplier = 1
    ): number {
        let total = 0;
        for (const selection of selectionSet.selections) {
            if (selection.kind === Kind.FIELD) {
                if (
                    !selection.selectionSet ||
                    isIntrospection(selection.name.value)
                ) {
                    // A leaf costs nothing beyond the record already counted,
                    // and an introspection field is answered from the schema
                    // already in memory — neither reaches the database.
                    continue;
                }
                if (CONTAINER_FIELDS.has(selection.name.value)) {
                    // `items` is the page its parent field already sized.
                    // Counting it as a list of its own would square every list
                    // in the query and reject perfectly ordinary documents.
                    total += this.complexity(
                        selection.selectionSet,
                        fragments,
                        sizes,
                        multiplier
                    );
                    continue;
                }
                const cost = multiplier * pageSizeOf(selection, sizes);
                total += cost;
                total += this.complexity(
                    selection.selectionSet,
                    fragments,
                    sizes,
                    cost
                );
                continue;
            }
            if (selection.kind === Kind.INLINE_FRAGMENT) {
                total += this.complexity(
                    selection.selectionSet,
                    fragments,
                    sizes,
                    multiplier
                );
                continue;
            }
            const fragment = fragments.get(selection.name.value);
            if (!fragment) {
                continue;
            }
            // Complexity is linear in the multiplier, so one walk at 1 answers
            // for every spread of the same fragment.
            total +=
                multiplier *
                memoised(this.complexities, fragment.name.value, () =>
                    this.complexity(fragment.selectionSet, fragments, sizes, 1)
                );
        }
        return total;
    }
}

/** Reads `cache[key]`, computing and storing it on a miss. */
function memoised(
    cache: Map<string, number>,
    key: string,
    compute: () => number
): number {
    const hit = cache.get(key);
    if (hit !== undefined) {
        return hit;
    }
    const value = compute();
    cache.set(key, value);
    return value;
}

/**
 * Whether a field is a GraphQL **introspection** meta-field.
 *
 * Introspection is deliberately enabled (the endpoint is authenticated and the
 * schema is already pruned to the caller's grants), and it is answered entirely
 * from the schema object already in memory — no resolver, no database. Costing
 * it against the same budget as a content read refuses the *standard*
 * introspection query outright: it is 15 levels deep and selects 220 fields,
 * so the defaults would break every codegen tool and GraphiQL itself, which
 * cannot draw a schema it is not allowed to read.
 */
function isIntrospection(fieldName: string): boolean {
    return fieldName.startsWith('__');
}

/**
 * Whether the document's fragments spread each other in a cycle.
 *
 * A plain DFS over the spread graph, linear in the document. It runs before the
 * cost walks so those can memoise per fragment name without having to reason
 * about a cycle broken off halfway.
 */
function hasFragmentCycle(fragments: Fragments): boolean {
    const done = new Set<string>();
    const onPath = new Set<string>();

    const visit = (name: string): boolean => {
        if (onPath.has(name)) {
            return true;
        }
        if (done.has(name)) {
            return false;
        }
        const fragment = fragments.get(name);
        if (!fragment) {
            return false;
        }
        onPath.add(name);
        const cyclic = spreadsOf(fragment.selectionSet).some(visit);
        onPath.delete(name);
        done.add(name);
        return cyclic;
    };

    return [...fragments.keys()].some(visit);
}

/** Every fragment name spread anywhere inside a selection set. */
function spreadsOf(selectionSet: SelectionSetNode): string[] {
    const names: string[] = [];
    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FRAGMENT_SPREAD) {
            names.push(selection.name.value);
            continue;
        }
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            names.push(...spreadsOf(selection.selectionSet));
            continue;
        }
        if (selection.selectionSet) {
            names.push(...spreadsOf(selection.selectionSet));
        }
    }
    return names;
}

/**
 * What a field is assumed to fetch when it names no `pageSize`. Matches the
 * expansion default the resolvers actually apply, so the estimate tracks the
 * real cost rather than a convenient fiction.
 */
const ASSUMED_PAGE_SIZE = 20;

/**
 * Fields that hold a page rather than being one. The parent list field already
 * carries the page size, so `items` must not multiply again — without this
 * every list in a query counts twice and a five-row-by-five-row request looks
 * like ten thousand records.
 */
const CONTAINER_FIELDS: ReadonlySet<string> = new Set(['items']);

/** Numeric variable values as the operation will actually see them. */
type PageSizes = Readonly<Record<string, number>>;

/**
 * The numbers a `pageSize:` variable can carry, from the request's variables
 * **and from the operation's own declared defaults**.
 *
 * A variable the caller omitted is not absent at execution time — graphql-js
 * substitutes the default written in the operation signature. Reading only the
 * supplied variables let `query Q($n: Int = 500)` cost the assumed 20 and then
 * run at 500, which is the budget defeated by writing the number one token
 * further left.
 */
function pageSizesFor(
    operation: OperationDefinitionNode,
    variables: Record<string, unknown>
): PageSizes {
    const sizes: Record<string, number> = {};
    for (const definition of operation.variableDefinitions ?? []) {
        const fallback = numericLiteral(definition);
        if (fallback !== undefined) {
            sizes[definition.variable.name.value] = fallback;
        }
    }
    for (const [name, value] of Object.entries(variables)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            sizes[name] = value;
        }
    }
    return sizes;
}

/** A variable definition's default value, when it is a number. */
function numericLiteral(
    definition: VariableDefinitionNode
): number | undefined {
    const node = definition.defaultValue;
    if (node && (node.kind === Kind.INT || node.kind === Kind.FLOAT)) {
        return Number(node.value);
    }
    return undefined;
}

/** A field's declared page size, from a literal or a variable. */
function pageSizeOf(
    selection: {
        arguments?: readonly { name: { value: string }; value: ValueNode }[];
    },
    sizes: PageSizes
): number {
    for (const argument of selection.arguments ?? []) {
        const name = argument.name.value;
        if (name !== 'pageSize' && name !== 'limit') {
            continue;
        }
        const node = argument.value;
        if (node.kind === Kind.INT) {
            return Math.max(Number(node.value), 1);
        }
        if (node.kind === Kind.VARIABLE) {
            const supplied = sizes[node.name.value];
            if (supplied !== undefined) {
                return Math.max(supplied, 1);
            }
        }
    }
    return ASSUMED_PAGE_SIZE;
}

/** The document's fragment definitions, by name. */
type Fragments = ReadonlyMap<string, FragmentDefinitionNode>;

/** The document's fragment definitions, by name. */
function fragmentsOf(document: DocumentNode): Fragments {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const definition of document.definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
            fragments.set(definition.name.value, definition);
        }
    }
    return fragments;
}
