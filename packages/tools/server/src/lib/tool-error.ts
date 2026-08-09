import { HttpException, HttpStatus, Logger } from '@nestjs/common';

/** A tool failure, flattened into something a model can read and act on. */
export interface ToolError {
    /** HTTP-ish status the underlying operation failed with. */
    status: number;
    /** A short machine label, e.g. `not_found`, `validation_failed`. */
    code: string;
    /** Human/model-readable explanation. */
    message: string;
    /** Per-field issues, when the failure was a validation one. */
    issues?: unknown;
}

/** Status → the short code a model sees. */
const CODES: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'bad_request',
    [HttpStatus.UNAUTHORIZED]: 'unauthorized',
    [HttpStatus.FORBIDDEN]: 'forbidden',
    [HttpStatus.NOT_FOUND]: 'not_found',
    [HttpStatus.CONFLICT]: 'conflict',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'validation_failed'
};

const logger = new Logger('McpTools');

/**
 * Turn whatever a tool handler threw into a {@link ToolError}.
 *
 * Tool handlers delegate to the very same services the HTTP controllers call,
 * so they throw Nest `HttpException`s — a 404 for an unknown entry, a 422
 * carrying per-field validation issues. Those are **the most useful thing a
 * model can be told**: "title must be at most 200 characters" is a failure it
 * can fix on the next call, so the issues are carried through verbatim rather
 * than flattened to "bad request".
 *
 * Anything that is *not* an `HttpException` is a bug, not a caller error. It is
 * logged with its stack for the operator and reported as a bare 500 — the
 * message could name a table, a column, or a connection string, and a tool
 * result is read by a third-party model.
 */
export function toToolError(error: unknown): ToolError {
    if (error instanceof HttpException) {
        const status = error.getStatus();
        const response = error.getResponse();
        const body =
            typeof response === 'object' && response !== null
                ? (response as Record<string, unknown>)
                : {};
        const message =
            typeof body['message'] === 'string'
                ? body['message']
                : Array.isArray(body['message'])
                  ? (body['message'] as unknown[]).join('; ')
                  : error.message;
        // `issues` is what the content plugin's 422 carries per field; keeping
        // the key intact is what makes a validation failure self-correcting.
        const issues = body['issues'];
        return {
            status,
            code: CODES[status] ?? 'error',
            message,
            ...(issues === undefined ? {} : { issues })
        };
    }

    logger.error(
        `Unhandled error in a tool handler: ${
            error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined
    );
    return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'internal_error',
        message: 'The tool failed unexpectedly. See the server logs.'
    };
}
