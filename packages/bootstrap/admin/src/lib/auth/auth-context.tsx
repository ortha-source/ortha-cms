import { createContext, useContext } from 'react';

/**
 * Minimal current-user shape the host needs to gate routes. The source plugin
 * (identity) owns the full user model; the host only cares about identity.
 */
export type AuthUser = {
    /** Stable user id. */
    id: string;
    /** User email, handy for rendering the signed-in account. */
    email: string;
};

/** Resolved auth state the host gates routes on. */
export type AuthState =
    | { status: 'loading'; user: null }
    | { status: 'authenticated'; user: AuthUser }
    | { status: 'unauthenticated'; user: null };

const AuthContext = createContext<AuthState | null>(null);

/**
 * Provider a source plugin uses to publish auth state into the host. Identity's
 * `AuthProvider` wraps the app with this (registered via the plugin's
 * `provider`), so the host's guard reads state without knowing identity's API.
 */
export const AuthProviderContext = AuthContext.Provider;

/**
 * Reads the current auth state. Falls back to `loading` when no provider has
 * resolved yet (or none is registered), so guards stay closed until a user is
 * confirmed — fail-closed.
 */
export function useAuth(): AuthState {
    return useContext(AuthContext) ?? { status: 'loading', user: null };
}
