import type {
    AcceptInviteInput,
    CurrentUser,
    InviteDetails,
    LoginCredentials,
    PasswordResetDetails,
    ResetPasswordInput
} from '../../../types/auth';

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
    /**
     * Resolves an invite link's token to who it is for via
     * `GET /api/auth/invite/:token`. Throws an `ApiError` on failure — `404`
     * covers every dead-link case (unknown, expired, already used), which the
     * server deliberately does not distinguish.
     */
    describeInvite(token: string): Promise<InviteDetails>;
    /**
     * Redeems an invite via `POST /api/auth/invite/accept`, setting the
     * account's first password. On success the server activates the account and
     * sets the session cookie, so the invitee is signed in — this resolves with
     * no value, like `login`. Throws an `ApiError` (`404` = dead link,
     * `400` = the password failed the server's rules).
     */
    acceptInvite(input: AcceptInviteInput): Promise<void>;
    /**
     * Resolves a reset link's token to the account it is for via
     * `GET /api/auth/reset/:token`. Throws an `ApiError` on failure — `404`
     * covers every dead-link case (unknown, expired, already used, or issued
     * for an account that is no longer active), which the server deliberately
     * does not distinguish.
     */
    describePasswordReset(token: string): Promise<PasswordResetDetails>;
    /**
     * Redeems a reset link via `POST /api/auth/reset`, setting the account's
     * new password and revoking every session it had open. Unlike
     * {@link AuthGateway.acceptInvite} this sets **no** session cookie — the
     * caller proved only that they hold a link, so they finish at the sign-in
     * form. Throws an `ApiError` (`404` = dead link, `400` = the password
     * failed the server's rules).
     */
    resetPassword(input: ResetPasswordInput): Promise<void>;
};
