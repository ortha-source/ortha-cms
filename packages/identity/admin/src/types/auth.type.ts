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
