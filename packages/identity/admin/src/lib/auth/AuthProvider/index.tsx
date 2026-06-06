import type { ReactNode } from 'react';
import { AuthProviderContext, type AuthState } from '@ortha-cms/bootstrap-admin';
import { useCurrentUser } from '../../api/useCurrentUser';

/**
 * Resolves the current user via `GET /api/auth/me` and publishes it into the
 * host's auth context, so the host's `RequireAuth` can gate routes without
 * knowing identity's endpoints. Registered as the identity plugin's `provider`,
 * it wraps the whole app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const { data, isPending } = useCurrentUser();

    const value: AuthState = isPending
        ? { status: 'loading', user: null }
        : data
          ? {
                status: 'authenticated',
                user: { id: data.id, email: data.email }
            }
          : { status: 'unauthenticated', user: null };

    return <AuthProviderContext value={value}>{children}</AuthProviderContext>;
}
