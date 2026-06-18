import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { currentUserKey } from '../useCurrentUser';

/**
 * Posts to `POST /api/auth/logout` via the shared `apiClient`. The server
 * revokes the presented session and clears the `httpOnly` cookie; it is
 * idempotent, so an already-expired session still succeeds.
 *
 * @throws {ApiError} normalized transport failure.
 */
async function logout(): Promise<void> {
    try {
        await apiClient.post('/auth/logout');
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * TanStack Query mutation for signing out. On success it invalidates the
 * current-user query ({@link currentUserKey}), so `AuthProvider` re-resolves to
 * "unauthenticated" and the route gate redirects to the sign-in page — the
 * mirror of the login flow. Callers just call `mutate()`.
 */
export function useLogoutMutation() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, void>({
        mutationFn: logout,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentUserKey });
        }
    });
}
