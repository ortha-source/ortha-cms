import { useQuery } from '@tanstack/react-query';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';

/**
 * Query key for the current-user fetch. Exported so the login/logout flows can
 * invalidate it and flip the host's auth state.
 */
export const currentUserKey = ['auth', 'me'] as const;

/**
 * TanStack Query wrapper for the current user, fetched through the
 * {@link AuthGateway} (`GET /api/auth/me`). `data === null` means
 * unauthenticated — a `401` resolves to `null` in the gateway rather than
 * throwing. The session lives in the `httpOnly` cookie, so the user is fetched
 * once on load (`staleTime: Infinity`) and refreshed by invalidating
 * {@link currentUserKey} after login/logout.
 */
export function useCurrentUser() {
    return useQuery({
        queryKey: currentUserKey,
        queryFn: () => httpAuthGateway.getCurrentUser(),
        retry: false,
        staleTime: Infinity
    });
}
