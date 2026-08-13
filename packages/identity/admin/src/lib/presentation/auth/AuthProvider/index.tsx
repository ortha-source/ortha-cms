import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setUnauthorizedHandler } from '@ortha-cms/utils-admin';
import {
    currentUserKey,
    useCurrentUser
} from '../../../application/useCurrentUser';
import {
    AuthProviderContext,
    AuthStatus,
    type AuthState
} from '../authContext';

/** What {@link AuthProvider} reads off the current-user query. */
type CurrentUserQuery = ReturnType<typeof useCurrentUser>;

/**
 * Maps the probe's query state onto the published {@link AuthState}.
 *
 * `data` present → authenticated. Otherwise, while a probe is in flight — the
 * initial load or a post-login/logout refetch — hold in `loading` so the gate
 * doesn't redirect on the stale "no user" gap between invalidating the query
 * and the fresh response landing.
 *
 * A settled probe then splits two ways, and the split matters: the gateway
 * turns a `401` into `data === null` (nobody is signed in — the ordinary signed
 * out state), and rethrows everything else. A `500`, a timeout or a dropped
 * connection therefore lands on `unavailable`, not `unauthenticated`, because
 * it tells us nothing about the session. Treating the two alike is what made an
 * API outage sign a perfectly valid session out.
 */
function toAuthState({
    data,
    isPending,
    isFetching,
    isError
}: CurrentUserQuery): AuthState {
    if (data) {
        return {
            status: AuthStatus.Authenticated,
            user: {
                id: data.id,
                email: data.email,
                name: data.name,
                permissions: data.permissions
            }
        };
    }
    if (isPending || isFetching) {
        return { status: AuthStatus.Loading, user: null };
    }
    if (isError) {
        return { status: AuthStatus.Unavailable, user: null };
    }
    return { status: AuthStatus.Unauthenticated, user: null };
}

/**
 * Resolves the current user via `GET /api/auth/me` and publishes it into the
 * auth context, so {@link RequireAuth} can gate routes. The shell composes this
 * around `RequireAuth` in its `layout`, so it wraps the private area (not the
 * public sign-in page); the host renders that layout without knowing any of this
 * exists.
 *
 * It also owns the **session-lost** reaction: while mounted it installs the
 * shared client's `401` handler, so a session that dies mid-visit — revoked from
 * another device, expired, or the account suspended by an admin — drops the
 * cached user and lands the visitor on the sign-in page instead of leaving a
 * shell that 401s on every request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const currentUser = useCurrentUser();
    const queryClient = useQueryClient();

    useEffect(() => {
        setUnauthorizedHandler(() => {
            // Answer the probe with "no user" rather than invalidating it: the
            // session is gone, so a refetch would only 401 again, and the null
            // settles the gate on `unauthenticated` at once. Deliberately not
            // `removeQueries`/`clear` — evicting queries that still have mounted
            // observers makes them refetch, and each refetch 401s straight back
            // into this handler. The redirect unmounts the private tree instead,
            // leaving its data inactive for the cache's own GC.
            queryClient.setQueryData(currentUserKey, null);
        });
        return () => setUnauthorizedHandler(null);
    }, [queryClient]);

    return (
        <AuthProviderContext value={toAuthState(currentUser)}>
            {children}
        </AuthProviderContext>
    );
}
