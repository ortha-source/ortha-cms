import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@ortha-cms/utils-admin';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';
import { currentUserKey } from '../useCurrentUser';
import { resetSessionCache } from '../resetSessionCache';

/**
 * TanStack Query mutation for signing out. Delegates to the {@link AuthGateway}
 * (`POST /api/auth/logout`); on success it settles the current-user probe
 * ({@link currentUserKey}) on "nobody" and drops everything else the session
 * cached, so `AuthProvider` reports "unauthenticated", the route gate redirects
 * to the sign-in page, and nothing of the outgoing account is left behind.
 * Callers just call `mutate()`.
 */
export function useLogoutMutation() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, void>({
        mutationFn: () => httpAuthGateway.logout(),
        onSuccess: () => {
            // Write `null` rather than invalidating: the session is gone, so a
            // refetch could only 401 its way to the same answer, and the write
            // settles the gate in this tick. It also has to happen *before* the
            // sweep below — the probe query is the one thing `AuthProvider` is
            // observing, and removing a query out from under a mounted observer
            // leaves it holding the value it already had.
            queryClient.setQueryData(currentUserKey, null);
            resetSessionCache(queryClient);
        }
    });
}
