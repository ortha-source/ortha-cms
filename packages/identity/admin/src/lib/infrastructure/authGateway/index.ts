import type { CurrentUser, LoginCredentials } from '../../../types/auth';

/**
 * The port over the remote auth API — the single seam the identity plugin talks
 * to instead of `apiClient` directly. Every method normalizes transport failures
 * to `ApiError`, so the application hooks (`useCurrentUser`/`useLoginMutation`/
 * `useLogoutMutation`) and the auth mechanism stay off the wire.
 * {@link httpAuthGateway} is the HTTP implementation.
 */
export type AuthGateway = {
    /**
     * Resolves the signed-in user via `GET /api/auth/me`, or `null` when the
     * request comes back `401` (the expected "not signed in" state). Any other
     * failure throws an `ApiError`.
     */
    getCurrentUser(): Promise<CurrentUser | null>;
    /**
     * Posts credentials to `POST /api/auth/login`. On success the server sets the
     * `httpOnly` session cookie and this resolves with no value — the cookie is
     * the auth state. Throws an `ApiError` on failure (`401` = invalid creds).
     */
    login(credentials: LoginCredentials): Promise<void>;
    /**
     * Posts to `POST /api/auth/logout`, revoking the presented session and
     * clearing the cookie. Idempotent — an already-expired session still
     * succeeds. Throws an `ApiError` on a transport failure.
     */
    logout(): Promise<void>;
};
