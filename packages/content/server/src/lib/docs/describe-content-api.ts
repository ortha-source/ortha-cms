/**
 * The content plugin's pass over the host's OpenAPI document.
 *
 * `@nestjs/swagger` reflects static TypeScript, and this plugin's contract is
 * runtime data: one generic controller set serves **every** code-defined
 * content type, so the scanner sees `/content/{typeName}` with an opaque string
 * param and no response shape at all. This pass fills both gaps from the
 * registry — the real type names as an enum, and a typed entry/list schema per
 * type — so a reader of the reference sees `article` and `home_page`, not
 * "some object".
 *
 * Pure: it takes the document and the serialized types, and mutates only the
 * paths this plugin owns.
 */

import type { OpenApiDocument } from '@ortha-cms/bootstrap-server';
import type { SerializedContentType } from '../registry/content-type-registry';
import type { OpenApiSchema } from './field-schema';
import { buildContentSchemas, ref, schemaNamesOf } from './content-schemas';

/** An operation object, as far as this pass needs to see one. */
interface Operation {
    parameters?: {
        name: string;
        in: string;
        schema?: OpenApiSchema;
        description?: string;
    }[];
    responses?: Record<string, { description?: string; content?: unknown }>;
}

/** Which schema a content route's success response carries. */
type ResponseKind =
    | { kind: 'entry' }
    | { kind: 'listPage' }
    | { kind: 'schema'; name: string }
    | { kind: 'empty' };

/** What one operation returns, and whether it can fail field validation. */
interface OperationSpec {
    response: ResponseKind;
    /**
     * The operation runs the values through `EntryValidationService`, so it can
     * answer **422** with per-field issues. Per operation, not per route: a
     * `GET` on the same path validates nothing.
     */
    validated?: boolean;
}

/** The entry read/write shorthands, since most operations return one. */
const ENTRY: OperationSpec = { response: { kind: 'entry' } };
const VALIDATED_ENTRY: OperationSpec = {
    response: { kind: 'entry' },
    validated: true
};
const EMPTY: OperationSpec = { response: { kind: 'empty' } };

/** An operation returning one of the fixed shared schemas. */
function shared(name: string): OperationSpec {
    return { response: { kind: 'schema', name } };
}

/** Entry routes, keyed by what follows `/content/{typeName}`. */
const ENTRY_ROUTES: Record<string, Record<string, OperationSpec>> = {
    '': { get: { response: { kind: 'listPage' } }, post: VALIDATED_ENTRY },
    '/{id}': { get: ENTRY, patch: VALIDATED_ENTRY, delete: EMPTY },
    '/{id}/media': { get: shared('EntryMedia') },
    '/{id}/relations': { get: shared('EntryRelations') },
    '/{id}/relations/{field}': { get: shared('RelationFieldPage') },
    '/{id}/publish': { post: VALIDATED_ENTRY },
    '/{id}/unpublish': { post: ENTRY },
    '/{id}/restore': { post: ENTRY },
    '/{id}/permanent': { delete: EMPTY },
    '/{id}/revisions': { get: shared('RevisionList') },
    '/{id}/revisions/{number}': { get: shared('RevisionDetail') },
    '/{id}/revisions/{number}/restore': { post: VALIDATED_ENTRY },
    '/{id}/revisions/{number}/publish': { post: VALIDATED_ENTRY },
    '/bulk': { post: shared('BulkSaveResult') },
    '/bulk/publish/preview': { post: shared('BulkPublishPreview') },
    '/bulk/publish': {
        post: { response: { kind: 'schema', name: 'BulkPublishResult' } }
    },
    '/bulk/unpublish': { post: shared('BulkActionResult') },
    '/bulk/delete': { post: shared('BulkActionResult') },
    '/bulk/restore': { post: shared('BulkActionResult') },
    '/bulk/purge': { post: shared('BulkActionResult') }
};

/** Schema routes, keyed by what follows `/content-schema`. */
const SCHEMA_ROUTES: Record<string, Record<string, OperationSpec>> = {
    '': { get: shared('ContentTypeSummaryList') },
    '/{name}': { get: shared('ContentTypeSchema') },
    '/{name}/filter-fields': { get: shared('FilterFields') }
};

/** Matches `<prefix>/content/{typeName}<rest>`. */
const ENTRY_ROUTE_RE = /\/content\/\{typeName\}(.*)$/;
/** Matches `<prefix>/content-schema<rest>`. */
const SCHEMA_ROUTE_RE = /\/content-schema(.*)$/;

/**
 * Writes a success response's schema onto whichever 2xx key the scanner already
 * emitted (Nest's default is 201 for `@Post`, 200 elsewhere, and a `@HttpCode`
 * moves it), so this never invents a status code the API doesn't return.
 */
function setSuccessResponse(
    operation: Operation,
    schema: OpenApiSchema,
    description: string
): void {
    const responses = operation.responses ?? {};
    const key = Object.keys(responses).find((code) => /^2\d\d$/.test(code));
    if (!key || key === '204') {
        return;
    }
    responses[key] = {
        description,
        content: { 'application/json': { schema } }
    };
    operation.responses = responses;
}

/** Adds a documented failure response, leaving any existing one alone. */
function addErrorResponse(
    operation: Operation,
    code: string,
    description: string,
    schema?: OpenApiSchema
): void {
    const responses = operation.responses ?? {};
    if (responses[code]) {
        return;
    }
    responses[code] = {
        description,
        ...(schema ? { content: { 'application/json': { schema } } } : {})
    };
    operation.responses = responses;
}

/** Constrains the `typeName` path param to the registered type names. */
function describeTypeNameParam(
    operation: Operation,
    typeNames: string[]
): void {
    const parameter = operation.parameters?.find(
        (candidate) => candidate.name === 'typeName' && candidate.in === 'path'
    );
    if (!parameter) {
        return;
    }
    parameter.schema = { type: 'string', enum: typeNames };
    parameter.description =
        'Machine name of the content type. Unknown (or not granted to the workspace) is a 404.';
}

/**
 * `oneOf` the per-type schemas — the response shape depends on `typeName`,
 * which OpenAPI can't express as a dependency, so the alternatives are listed.
 * A single registered type needs no union.
 */
function unionOf(names: string[]): OpenApiSchema {
    return names.length === 1
        ? ref(names[0])
        : { oneOf: names.map((name) => ref(name)) };
}

/**
 * Adds this plugin's schemas to `document` and describes its own operations:
 * the `typeName` enum, per-type response schemas, and the documented failures.
 */
export function describeContentApi(
    document: OpenApiDocument,
    types: readonly SerializedContentType[]
): void {
    document.components ??= {};
    document.components.schemas ??= {};
    Object.assign(document.components.schemas, buildContentSchemas(types));

    const typeNames = types.map((type) => type.name);
    const entryUnion = unionOf(types.map((type) => schemaNamesOf(type).entry));
    const listUnion = unionOf(
        types.map((type) => schemaNamesOf(type).listPage)
    );

    for (const [route, item] of Object.entries(document.paths)) {
        const entryMatch = ENTRY_ROUTE_RE.exec(route);
        const schemaMatch = SCHEMA_ROUTE_RE.exec(route);
        const rest = (entryMatch ?? schemaMatch)?.[1];
        if (rest === undefined) {
            continue;
        }
        const routes = entryMatch ? ENTRY_ROUTES : SCHEMA_ROUTES;
        const byMethod = routes[rest];
        if (!byMethod) {
            continue;
        }

        for (const [method, operation] of Object.entries(
            item as Record<string, Operation>
        )) {
            const spec = byMethod[method];
            if (!spec || !operation || typeof operation !== 'object') {
                continue;
            }

            if (entryMatch) {
                describeTypeNameParam(operation, typeNames);
                addErrorResponse(
                    operation,
                    '404',
                    'Unknown content type, or no entry with this id in the workspace.'
                );
                if (spec.validated) {
                    addErrorResponse(
                        operation,
                        '422',
                        'The values failed the content type’s field validation.',
                        {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                issues: {
                                    type: 'array',
                                    items: ref('ValidationIssue')
                                }
                            },
                            required: ['message', 'issues']
                        }
                    );
                }
            }

            // With no registered types there is no entry shape to describe —
            // and every one of these routes 404s anyway.
            const { response } = spec;
            if (response.kind === 'entry' && typeNames.length) {
                setSuccessResponse(operation, entryUnion, 'The entry.');
            } else if (response.kind === 'listPage' && typeNames.length) {
                setSuccessResponse(
                    operation,
                    listUnion,
                    'One page of entries.'
                );
            } else if (response.kind === 'schema') {
                setSuccessResponse(operation, ref(response.name), 'OK.');
            }
        }
    }
}
