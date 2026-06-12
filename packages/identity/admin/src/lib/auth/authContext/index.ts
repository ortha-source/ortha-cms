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
    /** Display name; `null` until the user sets one. */
    name: string | null;
    /**
     * Permission keys granted by the user's role, as returned by
     * `GET /api/auth/me`. Read via {@link useHasPermission} to gate pages and
     * controls; presentation only — the server re-checks every route.
     */
    permissions: readonly string[];
};

/**
 * The three states auth resolution can be in. Used as the `AuthState`
 * discriminant; `AuthProvider` sets it and `RequireAuth` branches on it, so the
 * literal lives here once instead of being re-typed at each call site.
 */
export enum AuthStatus {
    /** A probe (initial load or post-login/logout refetch) is in flight. */
    Loading = 'loading',
    /** A current user was resolved. */
    Authenticated = 'authenticated',
    /** A fetch completed with no user. */
    Unauthenticated = 'unauthenticated'
}

/** Resolved auth state the route gate reads. */
export type AuthState =
    | { status: AuthStatus.Loading; user: null }
    | { status: AuthStatus.Authenticated; user: AuthUser }
    | { status: AuthStatus.Unauthenticated; user: null };

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
    return (
        useContext(AuthContext) ?? { status: AuthStatus.Loading, user: null }
    );
}
