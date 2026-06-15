import { BadRequestException } from '@nestjs/common';

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
    MaxInListExceeded: 'FILTER_MAX_IN_LIST_EXCEEDED'
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
        super({
            statusCode: 400,
            error: 'Bad Request',
            code,
            message: `filter: ${message}`,
            ...context
        });
        this.code = code;
        this.context = context;
    }
}
