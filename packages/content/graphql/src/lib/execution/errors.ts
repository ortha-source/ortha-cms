import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';

/**
 * Turns a thrown `HttpException` into a `GraphQLError` carrying the same
 * information, and turns everything else into a blank wall.
 *
 * ## Why a mapper at all
 *
 * The resolvers call the REST services unchanged, so they throw the REST
 * exceptions: `NotFoundException` for an unknown type, `ForbiddenException` for
 * a scope failure, a 422 with per-field issues for a failed publish. That is the
 * point — the two protocols report the same facts because the same code decides
 * them. What GraphQL cannot inherit is the *channel*: the HTTP status is 200 for
 * an executed operation, so the status has to travel in the error instead.
 *
 * ## What a client sees
 *
 * `extensions.code` is a stable string to branch on, `extensions.status` the
 * HTTP status the REST equivalent would have returned, and `extensions.issues`
 * the per-field validation failures a 422 carries. A consumer porting from REST
 * keeps its error handling and changes where it reads the status from.
 *
 * ## What a client never sees
 *
 * Anything that is not an `HttpException` is a bug, not a fact about the
 * request. It is logged server-side with its stack and replaced with a fixed
 * message: a Postgres error text or a stack trace is exactly the sort of thing
 * that turns a token into a reconnaissance tool.
 */
export function toGraphQLError(
    error: unknown,
    logger: Logger
): GraphQLError | null {
    if (error === null || error === undefined) {
        return null;
    }
    if (error instanceof GraphQLError) {
        const original = error.originalError;
        if (original && !(original instanceof GraphQLError)) {
            const mapped = toGraphQLError(original, logger);
            return mapped
                ? new GraphQLError(mapped.message, {
                      nodes: error.nodes,
                      source: error.source,
                      positions: error.positions,
                      path: error.path,
                      extensions: { ...error.extensions, ...mapped.extensions }
                  })
                : error;
        }
        return error;
    }
    if (error instanceof HttpException) {
        const status = error.getStatus();
        const response = error.getResponse();
        return new GraphQLError(messageOf(response, error.message), {
            extensions: {
                code: codeFor(status),
                status,
                ...(issuesOf(response) ? { issues: issuesOf(response) } : {})
            }
        });
    }
    logger.error(
        'Unhandled error while executing a GraphQL operation',
        error instanceof Error ? error.stack : String(error)
    );
    return new GraphQLError('Internal server error.', {
        extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            status: HttpStatus.INTERNAL_SERVER_ERROR
        }
    });
}

/**
 * The stable `extensions.code` for an HTTP status.
 *
 * Named codes for the statuses a client branches on, and a generic
 * `status`-derived one for the rest — inventing a vocabulary wider than callers
 * actually use would be a contract to maintain for no one.
 */
function codeFor(status: number): string {
    switch (status) {
        case HttpStatus.BAD_REQUEST:
            return 'BAD_REQUEST';
        case HttpStatus.UNAUTHORIZED:
            return 'UNAUTHENTICATED';
        case HttpStatus.FORBIDDEN:
            return 'FORBIDDEN';
        case HttpStatus.NOT_FOUND:
            return 'NOT_FOUND';
        case HttpStatus.CONFLICT:
            return 'CONFLICT';
        case HttpStatus.UNPROCESSABLE_ENTITY:
            return 'VALIDATION_FAILED';
        default:
            return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
    }
}

/** The human-readable message out of a Nest exception response. */
function messageOf(response: unknown, fallback: string): string {
    if (typeof response === 'string') {
        return response;
    }
    if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message: unknown }).message;
        if (typeof message === 'string') {
            return message;
        }
        if (Array.isArray(message)) {
            return message.join('; ');
        }
    }
    return fallback;
}

/**
 * The per-field issues a 422 carries. Preserved verbatim, because "which field
 * failed and why" is the whole value of a validation error and re-shaping it
 * would make the two protocols disagree about the same failure.
 */
function issuesOf(response: unknown): unknown {
    if (response && typeof response === 'object' && 'issues' in response) {
        return (response as { issues: unknown }).issues;
    }
    return undefined;
}
