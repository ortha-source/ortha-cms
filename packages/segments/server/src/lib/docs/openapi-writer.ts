/**
 * Writing a response onto the generated OpenAPI document, with the one rule
 * every `decorate` pass in this repo follows: **never invent a status code.**
 *
 * The scanner has already emitted whichever 2xx key the handler answers with —
 * `201` for `POST /api/segments`, `200` for the rest — so a schema is written
 * onto *that* key rather than a guessed one, and a `204` (the segment delete)
 * is left with no body because that is what it sends.
 *
 * A local copy rather than an import from another plugin: it is a dozen lines,
 * and making it a cross-package export would turn one plugin's documentation
 * helper into public API that another plugin's release has to keep compatible.
 */

/** A JSON Schema fragment, as it appears in the OpenAPI document. */
export type OpenApiSchema = Record<string, unknown>;

/** An operation object, as far as this pass needs to see one. */
export interface Operation {
    parameters?: {
        name: string;
        in: string;
        schema?: OpenApiSchema;
        description?: string;
    }[];
    responses?: Record<string, { description?: string; content?: unknown }>;
}

/** `#/components/schemas/<name>`. */
export function ref(name: string): OpenApiSchema {
    return { $ref: `#/components/schemas/${name}` };
}

/** Writes a JSON success response onto whichever 2xx key the scanner emitted. */
export function setSuccessResponse(
    operation: Operation,
    schema: OpenApiSchema,
    description: string
): void {
    const responses = operation.responses ?? {};
    const key = Object.keys(responses).find((code) => /^2\d\d$/.test(code));
    // A `204` has no body; attaching one would describe a payload the server
    // never sends.
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
export function addErrorResponse(
    operation: Operation,
    code: string,
    description: string
): void {
    const responses = operation.responses ?? {};
    if (responses[code]) {
        return;
    }
    responses[code] = { description };
    operation.responses = responses;
}
