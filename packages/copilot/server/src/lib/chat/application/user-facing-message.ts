import { HttpException } from '@nestjs/common';

/** What the user and the model are told when the real message is not theirs. */
export const GENERIC_FAILURE = 'Something went wrong.';

/**
 * The message a failure may carry out of the run: into the SSE `error` frame,
 * into the `tool_result` the model reads, and into the `copilot_tool_calls` /
 * `copilot_proposals` rows.
 *
 * Tools deliberately throw plain `Error`s whose message is written for the
 * model ("No asset "…".", "Unknown content type …") and the services they call
 * throw `HttpException`s — both are passed through, a 422's per-field `issues`
 * included, because that is what lets the model correct its next call.
 *
 * What must **never** pass is a failure from below the application: a driver
 * error carries the SQL and its parameters (drizzle-orm's `DrizzleQueryError`
 * is literally `Failed query: <sql>\nparams: <values>`), a socket error names
 * hosts and ports, and a `TypeError` names the code's own variables. Those are
 * logged by the caller with their stack and reported as `fallback`. The whole
 * `cause` chain is checked, so wrapping one in an ordinary `Error` does not
 * launder it.
 */
export function userFacingMessage(
    error: unknown,
    fallback: string = GENERIC_FAILURE
): string {
    if (!(error instanceof Error) || namesInternals(error)) return fallback;

    if (error instanceof HttpException) {
        return httpExceptionMessage(error) || fallback;
    }
    return error.message || fallback;
}

/** An `HttpException`'s message plus, for a validation failure, its issues. */
function httpExceptionMessage(error: HttpException): string {
    const response = error.getResponse();
    const body =
        typeof response === 'object' && response !== null
            ? (response as Record<string, unknown>)
            : {};
    const message = Array.isArray(body['message'])
        ? (body['message'] as unknown[]).join('; ')
        : error.message;

    const issues = Array.isArray(body['issues'])
        ? (body['issues'] as unknown[])
              .map(describeIssue)
              .filter((issue): issue is string => issue !== null)
        : [];
    return issues.length > 0
        ? `${message.replace(/\.$/, '')}: ${issues.join('; ')}`
        : message;
}

/**
 * One issue as a phrase: content's `{ field, message }`, or the tool-argument
 * validator's `{ field, problems: [...] }`. `null` for any other shape.
 */
function describeIssue(issue: unknown): string | null {
    if (typeof issue !== 'object' || issue === null) return null;
    const { field, message, problems } = issue as Record<string, unknown>;
    const text =
        typeof message === 'string'
            ? message
            : Array.isArray(problems) &&
                problems.every((problem) => typeof problem === 'string')
              ? problems.join(', ')
              : null;
    if (!text) return null;
    return typeof field === 'string' ? `${field} ${text}` : text;
}

/** JavaScript's own error classes: a programmer error, never a sentence. */
const BUILT_IN_ERRORS: ReadonlyArray<new () => Error> = [
    TypeError,
    ReferenceError,
    RangeError,
    SyntaxError,
    EvalError,
    URIError
];

/** Whether `error`, or anything in its `cause` chain, is from below the app. */
function namesInternals(error: Error): boolean {
    if (BUILT_IN_ERRORS.some((kind) => error.constructor === kind)) {
        return true;
    }

    const seen = new Set<unknown>();
    let current: unknown = error;
    while (typeof current === 'object' && current !== null) {
        if (seen.has(current)) break;
        seen.add(current);
        if (isDriverError(current)) return true;
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

/**
 * A database or socket failure, recognised structurally so this package needs
 * no driver import: drizzle's query wrapper, `pg`'s `DatabaseError` (whose
 * `name` is the protocol's `'error'`, hence the constructor), anything carrying
 * a five-character SQLSTATE `code`, and Node's system errors (`errno` /
 * `syscall`, e.g. `ECONNREFUSED 10.0.0.5:5432`).
 */
function isDriverError(value: object): boolean {
    const record = value as Record<string, unknown>;
    const name = value.constructor?.name;
    if (name === 'DrizzleQueryError' || name === 'DatabaseError') return true;
    // Anywhere in the message, not only at its start: the batch appliers
    // (content's bulk save, i18n's bulk translation) report which item failed
    // by interpolating the inner error's message into their own, which carries
    // a driver error's text along without its class or its `cause`.
    if (
        typeof record['message'] === 'string' &&
        record['message'].includes('Failed query:')
    ) {
        return true;
    }
    if (
        typeof record['code'] === 'string' &&
        /^[0-9A-Z]{5}$/.test(record['code'])
    ) {
        return true;
    }
    return (
        typeof record['errno'] === 'number' ||
        typeof record['syscall'] === 'string'
    );
}
