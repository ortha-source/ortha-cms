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

    constructor(status: number | null, message?: string) {
        super(
            message ??
                (status === null
                    ? 'Network error'
                    : `Request failed with status ${status}`)
        );
        this.name = 'ApiError';
        this.status = status;
    }
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
        return new ApiError(error.response?.status ?? null, error.message);
    }
    return new ApiError(
        null,
        error instanceof Error ? error.message : undefined
    );
}
