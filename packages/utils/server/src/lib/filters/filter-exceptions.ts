import {
    BadRequestException,
    InternalServerErrorException
} from '@nestjs/common';

/** Machine-readable codes for filter parse errors. */
export const FilterErrorCode = {
    /** `filter` was not an object (e.g. a string or array). */
    InvalidShape: 'FILTER_INVALID_SHAPE',
    /** Parser reached a leaf with no path segments. */
    EmptyPath: 'FILTER_EMPTY_PATH',
    /** Dotted path longer than `schema.maxDepth`. */
    DepthExceeded: 'FILTER_DEPTH_EXCEEDED',
    /** Operator not in the global operator vocabulary. */
    UnknownOperator: 'FILTER_UNKNOWN_OPERATOR',
    /**
     * Operator is a real one, but not one the field's declared type can be
     * asked — e.g. `ilike` against a `date`, a `number`, a `boolean` or a
     * `uuid`. Postgres has no `~~` for those column types, so without this the
     * rule reached the driver and came back as an unhandled 500 instead of a
     * per-field issue.
     */
    OperatorNotAllowed: 'FILTER_OPERATOR_NOT_ALLOWED',
    /** Final segment names a field not declared on the schema. */
    UnknownField: 'FILTER_UNKNOWN_FIELD',
    /** Mid-path segment names a relation not declared on the schema. */
    UnknownRelation: 'FILTER_UNKNOWN_RELATION',
    /** Value failed type coercion (uuid/number/boolean/date/enum/null). */
    InvalidValue: 'FILTER_INVALID_VALUE',
    /** `filter` was a string but did not parse as JSON. */
    InvalidJson: 'FILTER_INVALID_JSON',
    /** Tree node was neither a recognised group nor a rule. */
    InvalidNode: 'FILTER_INVALID_NODE',
    /** Tree exceeded `schema.maxNodes` (default 50). */
    MaxNodesExceeded: 'FILTER_MAX_NODES_EXCEEDED',
    /** Group nesting exceeded `schema.maxGroupDepth` (default 5). */
    GroupDepthExceeded: 'FILTER_GROUP_DEPTH_EXCEEDED',
    /**
     * `in`/`nin` value list was empty. Rejected because an empty `in`
     * matches no rows and an empty `nin` matches every row — a silent
     * no-op/inverted filter rather than the user's intent.
     */
    EmptyInList: 'FILTER_EMPTY_IN_LIST',
    /** `in`/`nin` value list exceeded `schema.maxInListLength` (default 100). */
    MaxInListExceeded: 'FILTER_MAX_IN_LIST_EXCEEDED',
    /**
     * A single clause's string value exceeded `schema.maxValueLength`
     * (default 4096) — the engine's only budget over *text* rather than over
     * the tree's structure. Reported per clause, naming the offending path, so
     * a client can point at the rule rather than at the whole filter.
     */
    ValueTooLong: 'FILTER_VALUE_TOO_LONG'
} as const;

/** One of the {@link FilterErrorCode} values. */
export type FilterErrorCode =
    (typeof FilterErrorCode)[keyof typeof FilterErrorCode];

/**
 * Typed 400 exception thrown by the filter parser.
 *
 * Still a `BadRequestException` under the hood so NestJS returns HTTP 400,
 * but the response body carries a `code` (from {@link FilterErrorCode}) and
 * a `context` object so clients can key off the category rather than
 * string-matching the message.
 *
 * Example response body:
 * ```json
 * {
 *     "statusCode": 400,
 *     "error": "Bad Request",
 *     "code": "FILTER_UNKNOWN_FIELD",
 *     "message": "filter: unknown field \"secretField\"",
 *     "path": "secretField"
 * }
 * ```
 */
export class FilterException extends BadRequestException {
    /** Machine-readable error category. */
    public readonly code: FilterErrorCode;
    /** Structured context about where the error occurred. */
    public readonly context: Readonly<Record<string, unknown>>;

    constructor(
        code: FilterErrorCode,
        message: string,
        context: Record<string, unknown> = {}
    ) {
        // `context` is spread FIRST so the four reserved keys always win. The
        // whole contract of this class is that a client can branch on `code`
        // and on the 400 status; a context key named `code` / `statusCode` /
        // `error` / `message` must not be able to rewrite them — a caller adding
        // a plausible context field (`message: 'why'`) would otherwise silently
        // break every consumer of the envelope.
        super({
            ...context,
            statusCode: 400,
            error: 'Bad Request',
            code,
            message: `filter: ${message}`
        });
        this.code = code;
        this.context = context;
    }
}

/**
 * Thrown when the **schema** a caller declared cannot be translated — a
 * `many-to-many` with target fields but no `table`, a `fields` entry naming a
 * column that is not on the table, a nested `fields` map with no matching
 * `relations` entry, or a table with no `id` and no explicit key.
 *
 * Deliberately a **500**, not a {@link FilterException} 400: the request was
 * well-formed and the whitelist accepted it — what is broken is the schema the
 * plugin author wrote. Answering 400 would blame the client, hide the fault
 * from alerting (4xx is a client error) and leave the schema bug in place. What
 * the bare `Error` these replace got wrong is only that it was untyped and
 * indistinguishable from a genuine crash: a named class with a `code` lets a
 * transport adapter (MCP's JSON-RPC mapping, the copilot run loop) report
 * "this endpoint's filter surface is misconfigured" instead of an opaque
 * "internal error".
 */
export class FilterSchemaException extends InternalServerErrorException {
    /** Machine-readable error category — always `FILTER_SCHEMA_INVALID`. */
    public readonly code = 'FILTER_SCHEMA_INVALID';

    constructor(message: string) {
        super({
            statusCode: 500,
            error: 'Internal Server Error',
            code: 'FILTER_SCHEMA_INVALID',
            message: `filter schema: ${message}`
        });
    }
}
