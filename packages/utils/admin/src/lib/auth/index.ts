import { createContext, useContext } from 'react';

/**
 * Minimal current-user shape the host needs to gate routes. The source plugin
 * (identity) owns the full user model; the gate only cares about identity.
 */
export type AuthUser = {
    /** Stable user id. */
    id: string;
    /** User email, handy for rendering the signed-in account. */
    email: string;
};

/** Resolved auth state the route gate reads. */
export type AuthState =
    | { status: 'loading'; user: null }
    | { status: 'authenticated'; user: AuthUser }
    | { status: 'unauthenticated'; user: null };

const AuthContext = createContext<AuthState | null>(null);

/**
 * Provider a source plugin uses to publish auth state. Identity's `AuthProvider`
 * wraps the app with this (registered via its plugin `provider`); the host's
 * `RequireAuth` reads it with {@link useAuth}.
 *
 * It lives here in the shared leaf — not in `bootstrap-admin` — so the producer
 * (identity) and the consumer (the host gate) both depend *down* on this
 * contract instead of a plugin depending on the composition root, exactly like
 * `apiClient`/`queryClient`.
 */
export const AuthProviderContext = AuthContext.Provider;

/**
 * Reads the current auth state. Falls back to `loading` when no provider has
 * resolved yet (or none is registered), so the gate stays closed until a user is
 * confirmed — fail-closed.
 */
export function useAuth(): AuthState {
    return useContext(AuthContext) ?? { status: 'loading', user: null };
}
