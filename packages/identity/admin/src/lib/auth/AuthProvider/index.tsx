import type { ReactNode } from 'react';
import { useCurrentUser } from '../../api/useCurrentUser';
import { AuthProviderContext, AuthStatus, type AuthState } from '../authContext';

/**
 * Resolves the current user via `GET /api/auth/me` and publishes it into the
 * auth context, so {@link RequireAuth} can gate routes. The shell composes this
 * around `RequireAuth` in its `layout`, so it wraps the private area (not the
 * public sign-in page); the host renders that layout without knowing any of this
 * exists.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const { data, isPending, isFetching } = useCurrentUser();

    // `data` present → authenticated. Otherwise, while the probe is in flight —
    // the initial load or a post-login/logout refetch — hold in `loading` so the
    // gate doesn't redirect on the stale "no user" gap between invalidating the
    // query and the fresh response landing; only settle on `unauthenticated`
    // once a fetch has completed with no user.
    const value: AuthState = data
        ? {
              status: AuthStatus.Authenticated,
              user: { id: data.id, email: data.email, name: data.name }
          }
        : isPending || isFetching
          ? { status: AuthStatus.Loading, user: null }
          : { status: AuthStatus.Unauthenticated, user: null };

    return <AuthProviderContext value={value}>{children}</AuthProviderContext>;
}
