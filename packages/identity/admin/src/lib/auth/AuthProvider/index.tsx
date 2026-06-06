import type { ReactNode } from 'react';
import { AuthProviderContext, type AuthState } from '@ortha-cms/utils-admin';
import { useCurrentUser } from '../../api/useCurrentUser';

/**
 * Resolves the current user via `GET /api/auth/me` and publishes it into the
 * host's auth context, so the host's `RequireAuth` can gate routes without
 * knowing identity's endpoints. Registered as the identity plugin's `provider`,
 * it wraps the whole app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const { data, isPending, isFetching } = useCurrentUser();

    // `data` present → authenticated. Otherwise, while the probe is in flight —
    // the initial load or a post-login/logout refetch — hold in `loading` so the
    // gate doesn't redirect on the stale "no user" gap between invalidating the
    // query and the fresh response landing; only settle on `unauthenticated`
    // once a fetch has completed with no user.
    const value: AuthState = data
        ? { status: 'authenticated', user: { id: data.id, email: data.email } }
        : isPending || isFetching
          ? { status: 'loading', user: null }
          : { status: 'unauthenticated', user: null };

    return <AuthProviderContext value={value}>{children}</AuthProviderContext>;
}
