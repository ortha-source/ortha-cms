import {
    GraphQLError,
    Kind,
    type DocumentNode,
    type FragmentDefinitionNode,
    type OperationDefinitionNode,
    type SelectionSetNode
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
    const errors: GraphQLError[] = [];

    const depth = depthOf(operation.selectionSet, fragments, new Set());
    if (depth > limits.maxDepth) {
        errors.push(
            new GraphQLError(
                `Query is ${depth} levels deep; the limit is ${limits.maxDepth}. Split it, or fetch the deeper records in a second request.`,
                { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
            )
        );
    }

    const fields = countFields(operation.selectionSet, fragments, new Set());
    if (fields > limits.maxAliases) {
        errors.push(
            new GraphQLError(
                `Query selects ${fields} fields; the limit is ${limits.maxAliases}.`,
                { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
            )
        );
    }

    const complexity = estimateComplexity(
        operation.selectionSet,
        fragments,
        variables,
        new Set()
    );
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
 * Deepest selection path, following fragments.
 *
 * `visiting` breaks a cyclic fragment spread. graphql-js's own validation
 * rejects those, but this runs **before** validation — a document is
 * length-checked, parsed, and cost-checked first, precisely so an expensive
 * document is refused as early as possible — so it cannot assume a valid one.
 */
function depthOf(
    selectionSet: SelectionSetNode,
    fragments: Map<string, FragmentDefinitionNode>,
    visiting: ReadonlySet<string>
): number {
    let deepest = 0;
    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            const nested = selection.selectionSet
                ? depthOf(selection.selectionSet, fragments, visiting)
                : 0;
            deepest = Math.max(deepest, nested + 1);
            continue;
        }
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            deepest = Math.max(
                deepest,
                depthOf(selection.selectionSet, fragments, visiting)
            );
            continue;
        }
        const name = selection.name.value;
        const fragment = fragments.get(name);
        if (!fragment || visiting.has(name)) {
            continue;
        }
        deepest = Math.max(
            deepest,
            depthOf(
                fragment.selectionSet,
                fragments,
                new Set([...visiting, name])
            )
        );
    }
    return deepest;
}

/** Total field selections in the operation, aliases included. */
function countFields(
    selectionSet: SelectionSetNode,
    fragments: Map<string, FragmentDefinitionNode>,
    visiting: ReadonlySet<string>
): number {
    let count = 0;
    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            count += 1;
            if (selection.selectionSet) {
                count += countFields(
                    selection.selectionSet,
                    fragments,
                    visiting
                );
            }
            continue;
        }
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            count += countFields(selection.selectionSet, fragments, visiting);
            continue;
        }
        const name = selection.name.value;
        const fragment = fragments.get(name);
        if (!fragment || visiting.has(name)) {
            continue;
        }
        count += countFields(
            fragment.selectionSet,
            fragments,
            new Set([...visiting, name])
        );
    }
    return count;
}

/**
 * Rough count of the records an operation could touch: each field's page size
 * multiplied down its nesting path, summed across siblings.
 *
 * An **estimate**, and deliberately a pessimistic one — it assumes every list
 * comes back full. That is the right bias for a budget: the point is to refuse
 * the shapes that *can* be enormous, and a query that would have returned three
 * rows is not the one straining the database.
 *
 * A field with no explicit page size counts as {@link ASSUMED_PAGE_SIZE} rather
 * than 1, because the server's own default is what it will actually fetch.
 */
export function estimateComplexity(
    selectionSet: SelectionSetNode,
    fragments: Map<string, FragmentDefinitionNode>,
    variables: Record<string, unknown>,
    visiting: ReadonlySet<string>,
    multiplier = 1
): number {
    let total = 0;
    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            if (!selection.selectionSet) {
                // A leaf costs nothing beyond the record already counted.
                continue;
            }
            if (CONTAINER_FIELDS.has(selection.name.value)) {
                // `items` is the page its parent field already sized. Counting
                // it as a list of its own would square every list in the query
                // and reject perfectly ordinary documents.
                total += estimateComplexity(
                    selection.selectionSet,
                    fragments,
                    variables,
                    visiting,
                    multiplier
                );
                continue;
            }
            const size = pageSizeOf(selection, variables);
            const cost = multiplier * size;
            total += cost;
            total += estimateComplexity(
                selection.selectionSet,
                fragments,
                variables,
                visiting,
                cost
            );
            continue;
        }
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            total += estimateComplexity(
                selection.selectionSet,
                fragments,
                variables,
                visiting,
                multiplier
            );
            continue;
        }
        const name = selection.name.value;
        const fragment = fragments.get(name);
        if (!fragment || visiting.has(name)) {
            continue;
        }
        total += estimateComplexity(
            fragment.selectionSet,
            fragments,
            variables,
            new Set([...visiting, name]),
            multiplier
        );
    }
    return total;
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

/** A field's declared page size, from a literal or a variable. */
function pageSizeOf(
    selection: {
        arguments?: readonly { name: { value: string }; value: unknown }[];
    },
    variables: Record<string, unknown>
): number {
    for (const argument of selection.arguments ?? []) {
        const name = argument.name.value;
        if (name !== 'pageSize' && name !== 'limit') {
            continue;
        }
        const node = argument.value as {
            kind: string;
            value?: string;
            name?: { value: string };
        };
        if (node.kind === Kind.INT && node.value !== undefined) {
            return Math.max(Number(node.value), 1);
        }
        if (node.kind === Kind.VARIABLE && node.name) {
            const supplied = variables[node.name.value];
            if (typeof supplied === 'number' && Number.isFinite(supplied)) {
                return Math.max(supplied, 1);
            }
        }
    }
    return ASSUMED_PAGE_SIZE;
}

/** The document's fragment definitions, by name. */
function fragmentsOf(
    document: DocumentNode
): Map<string, FragmentDefinitionNode> {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const definition of document.definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
            fragments.set(definition.name.value, definition);
        }
    }
    return fragments;
}
