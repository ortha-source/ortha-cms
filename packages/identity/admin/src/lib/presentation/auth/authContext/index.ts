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
    /** Permission keys the user's role grants; drives permission-aware UI. */
    permissions: string[];
};

/**
 * The states auth resolution can be in. Used as the `AuthState` discriminant;
 * `AuthProvider` sets it and `RequireAuth` branches on it, so the literal lives
 * here once instead of being re-typed at each call site.
 *
 * `Unauthenticated` and `Unavailable` are deliberately separate: "the server
 * says nobody is signed in" and "we could not ask the server" look identical in
 * a two-way split, and collapsing them makes every API outage present itself to
 * a signed-in user as a sign-out.
 */
export enum AuthStatus {
    /** A probe (initial load or post-login/logout refetch) is in flight. */
    Loading = 'loading',
    /** A current user was resolved. */
    Authenticated = 'authenticated',
    /** A fetch completed with no user — the session is gone or never existed. */
    Unauthenticated = 'unauthenticated',
    /** The probe failed for a reason other than `401`; who is signed in is unknown. */
    Unavailable = 'unavailable'
}

/** Resolved auth state the route gate reads. */
export type AuthState =
    | { status: AuthStatus.Loading; user: null }
    | { status: AuthStatus.Authenticated; user: AuthUser }
    | { status: AuthStatus.Unauthenticated; user: null }
    | { status: AuthStatus.Unavailable; user: null };

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
    return useContext(AuthContext) ?? { status: AuthStatus.Loading, user: null };
}

/**
 * Whether the signed-in user holds `permission`. Fail-closed: returns `false`
 * for every status but `Authenticated` — loading, signed out, or unreachable —
 * so permission-gated UI stays hidden until a grant is confirmed. Use it to
 * gate actions (e.g. show the
 * "New workspace" button only with `workspaces:create`); the server enforces the
 * same permission, this just keeps the UI honest.
 */
export function useHasPermission(permission: string): boolean {
    const auth = useAuth();
    return (
        auth.status === AuthStatus.Authenticated &&
        auth.user.permissions.includes(permission)
    );
}
