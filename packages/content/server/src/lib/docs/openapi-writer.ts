/**
 * The two writes every `decorate` pass in this package makes on the generated
 * document, and the one rule they both follow: **never invent a status code.**
 *
 * The scanner has already emitted whichever 2xx key the handler actually
 * answers with — 201 for a bare `@Post`, 200 elsewhere, and whatever a
 * `@HttpCode` moved it to — so a schema is written *onto that key* rather than
 * onto a guessed one. A document that describes a `200` for a route answering
 * `201` is worse than a document that describes nothing, because a consumer
 * cannot tell it is wrong without curling the API, which is the whole thing
 * these passes exist to make unnecessary.
 */

import type { OpenApiSchema } from './field-schema';

/** An operation object, as far as these passes need to see one. */
export interface Operation {
    parameters?: {
        name: string;
        in: string;
        schema?: OpenApiSchema;
        description?: string;
    }[];
    responses?: Record<string, { description?: string; content?: unknown }>;
}

/**
 * Writes a success response's schema onto whichever 2xx key the scanner already
 * emitted.
 *
 * `204` is left alone deliberately: a no-content response has no body, and
 * attaching one would describe a payload the server never sends.
 */
export function setSuccessResponse(
    operation: Operation,
    schema: OpenApiSchema,
    description: string,
    /**
     * Media type. `application/json` for all but the two transfer downloads,
     * which stream a file.
     */
    mediaType = 'application/json',
    /** Response headers worth documenting, keyed by header name. */
    headers?: Record<string, unknown>
): void {
    const responses = operation.responses ?? {};
    const key = Object.keys(responses).find((code) => /^2\d\d$/.test(code));
    if (!key || key === '204') {
        return;
    }
    responses[key] = {
        description,
        ...(headers ? { headers } : {}),
        content: { [mediaType]: { schema } }
    };
    operation.responses = responses;
}

/**
 * Writes a success response carrying several media types — one download route
 * whose content type depends on what the caller asked for.
 */
export function setSuccessResponseVariants(
    operation: Operation,
    byMediaType: Record<string, OpenApiSchema>,
    description: string,
    headers?: Record<string, unknown>
): void {
    const responses = operation.responses ?? {};
    const key = Object.keys(responses).find((code) => /^2\d\d$/.test(code));
    if (!key || key === '204') {
        return;
    }
    responses[key] = {
        description,
        ...(headers ? { headers } : {}),
        content: Object.fromEntries(
            Object.entries(byMediaType).map(([type, schema]) => [
                type,
                { schema }
            ])
        )
    };
    operation.responses = responses;
}

/** Adds a documented failure response, leaving any existing one alone. */
export function addErrorResponse(
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
