import { QueryClient } from '@tanstack/react-query';
import { toApiError } from '../apiError';

/** How many times a genuinely retryable failure is re-attempted. */
const MAX_RETRIES = 3;

/**
 * The two `4xx` codes that describe a *temporary* condition rather than a
 * settled answer, so waiting and asking again is exactly the right response.
 */
const RETRYABLE_CLIENT_ERRORS = new Set([
    408, // Request Timeout
    429 // Too Many Requests — the caller is meant to back off, not give up
]);

/**
 * Whether a failed query is worth re-attempting. Most of `4xx` is the server's
 * considered answer — a 404 for a deleted record, a 400 for an out-of-range
 * page, a 403 for a permission the caller doesn't hold — so repeating the same
 * request cannot change it. Retrying anyway costs the user the full backoff
 * ladder (~12s) sitting on a loading skeleton before the page can show them the
 * error or empty state it already knew about. Network failures, `5xx`, and the
 * two transient client errors above are still retried.
 */
function isWorthRetrying(error: unknown): boolean {
    const { status } = toApiError(error);
    if (status === null) {
        // No response at all — a transport failure, which is the canonical
        // case for a retry.
        return true;
    }
    if (RETRYABLE_CLIENT_ERRORS.has(status)) {
        return true;
    }
    return status < 400 || status >= 500;
}

/**
 * The app's single TanStack Query client. The host mounts it once via
 * `QueryClientProvider` (in `createAdmin`); plugins read/write server state
 * through `useQuery`/`useMutation` against it. A module singleton is fine for
 * this client-only SPA (no SSR, so no per-request isolation needed).
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) =>
                failureCount < MAX_RETRIES && isWorthRetrying(error)
        }
    }
});
