import { useQuery } from '@tanstack/react-query';
import { apiClient, HTTP_STATUS, toApiError } from '@ortha-cms/utils-admin';
import type { CurrentUser } from '../../../types/auth';

/**
 * Query key for the current-user fetch. Exported so the login/logout flows can
 * invalidate it and flip the host's auth state.
 */
export const currentUserKey = ['auth', 'me'] as const;

/**
 * Fetches `GET /api/auth/me` via the shared `apiClient`. A `401` is the expected
 * "not signed in" state, so it resolves to `null` rather than throwing; any
 * other failure re-throws as an {@link ApiError}.
 */
async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const { data } = await apiClient.get<CurrentUser>('/auth/me');
        return data;
    } catch (error) {
        const apiError = toApiError(error);
        if (apiError.status === HTTP_STATUS.UNAUTHORIZED) {
            return null;
        }
        throw apiError;
    }
}

/**
 * TanStack Query wrapper for the current user. `data === null` means
 * unauthenticated. The session lives in the `httpOnly` cookie, so the user is
 * fetched once on load (`staleTime: Infinity`) and refreshed by invalidating
 * {@link currentUserKey} after login/logout.
 */
export function useCurrentUser() {
    return useQuery({
        queryKey: currentUserKey,
        queryFn: fetchCurrentUser,
        retry: false,
        staleTime: Infinity
    });
}
