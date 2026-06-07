import { createContext, useContext } from 'react';

/**
 * Minimal current-user shape the gate needs. {@link AuthProvider} owns the full
 * user model; the gate only cares about identity.
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
 * Provider that publishes auth state. {@link AuthProvider} wraps the private
 * area with this; {@link useAuth} reads it. Both live in this plugin — the host
 * never sees auth state, it only mounts the shell's `layout` (which composes the
 * provider + gate).
 */
export const AuthProviderContext = AuthContext.Provider;

/**
 * Reads the current auth state. Falls back to `loading` when no provider has
 * resolved yet, so the gate stays closed until a user is confirmed — fail-closed.
 */
export function useAuth(): AuthState {
    return useContext(AuthContext) ?? { status: 'loading', user: null };
}
