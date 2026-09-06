import { isAxiosError } from 'axios';

/**
 * A transport-level request failure, normalized so call sites don't each have
 * to unwrap axios internals. `status` is the HTTP status when the server
 * responded, or `null` for a network/transport failure (no response). Domain
 * meaning (e.g. "a 401 means invalid credentials") is decided by the caller via
 * {@link HTTP_STATUS}, not encoded here.
 */
export class ApiError extends Error {
    /** HTTP status if the server responded; `null` for a network/transport error. */
    readonly status: number | null;
    /**
     * The parsed response body when the server responded, else `undefined`.
     * Opaque here — callers narrow it to their endpoint's error shape (e.g. a
     * 422's `{ issues: [{ field, message }] }`). The transport layer doesn't
     * decide its meaning.
     */
    readonly details?: unknown;
    /**
     * Seconds from the `Retry-After` response header, when the server sent one.
     * `@nestjs/throttler` puts it on every 429, and it is the only part of that
     * answer a caller can act on — "try again" is useless advice without it.
     *
     * A transport fact, like {@link status}: what it means for the UI is the
     * caller's to decide. `undefined` when the header is absent or not a
     * positive number of seconds (it may also carry an HTTP date, which nothing
     * here needs yet — better to say nothing than to show a wrong countdown).
     */
    readonly retryAfterSeconds?: number;

    constructor(
        status: number | null,
        message?: string,
        details?: unknown,
        retryAfterSeconds?: number
    ) {
        super(
            message ??
                (status === null
                    ? 'Network error'
                    : `Request failed with status ${status}`)
        );
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

/**
 * `Retry-After` read as a whole number of seconds, or `undefined`.
 *
 * Axios lower-cases response header names, but the value may arrive as a string
 * or an array depending on the adapter, and the header's other legal form is an
 * HTTP date — which `Number` turns into `NaN` rather than a wrong number.
 */
function readRetryAfter(headers: unknown): number | undefined {
    if (!headers || typeof headers !== 'object') {
        return undefined;
    }
    const raw = (headers as Record<string, unknown>)['retry-after'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string' && typeof value !== 'number') {
        return undefined;
    }
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0
        ? Math.ceil(seconds)
        : undefined;
}

/**
 * Normalizes an unknown thrown value (typically an axios error) into an
 * {@link ApiError}. Use it in a request's `catch` so the rest of the app only
 * ever deals with `ApiError`.
 */
export function toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
        return error;
    }
    if (isAxiosError(error)) {
        return new ApiError(
            error.response?.status ?? null,
            error.message,
            error.response?.data,
            readRetryAfter(error.response?.headers)
        );
    }
    return new ApiError(
        null,
        error instanceof Error ? error.message : undefined
    );
}
