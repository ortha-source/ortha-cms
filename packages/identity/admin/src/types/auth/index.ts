/**
 * Credentials submitted via the login form.
 */
export type LoginCredentials = {
    /** User email address. */
    email: string;
    /** User password. */
    password: string;
};

/**
 * The authenticated user as returned by `GET /api/auth/me`. Mirrors the
 * server's `PublicUser` projection.
 */
export type CurrentUser = {
    /** Stable user id. */
    id: string;
    /** User email address. */
    email: string;
    /** Id of the user's role. */
    roleId: string;
    /** Account status (e.g. `active`). */
    status: string;
};

/**
 * Token pair returned from a successful login.
 */
export type AuthTokens = {
    /** JWT access token. */
    accessToken: string;
    /** Opaque refresh token. */
    refreshToken: string;
    /** ISO timestamp when the access token expires. */
    accessTokenExpiresAt: string;
    /** ISO timestamp when the refresh token expires. */
    refreshTokenExpiresAt: string;
};
