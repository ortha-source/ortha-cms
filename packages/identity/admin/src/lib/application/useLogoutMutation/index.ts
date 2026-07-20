import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@ortha-cms/utils-admin';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';
import { currentUserKey } from '../useCurrentUser';

/**
 * TanStack Query mutation for signing out. Delegates to the {@link AuthGateway}
 * (`POST /api/auth/logout`); on success it invalidates the current-user query
 * ({@link currentUserKey}), so `AuthProvider` re-resolves to "unauthenticated"
 * and the route gate redirects to the sign-in page — the mirror of the login
 * flow. Callers just call `mutate()`.
 */
export function useLogoutMutation() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, void>({
        mutationFn: () => httpAuthGateway.logout(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentUserKey });
        }
    });
}
