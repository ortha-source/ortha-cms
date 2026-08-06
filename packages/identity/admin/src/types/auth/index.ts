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
    /** Display name; `null` until the user sets one. */
    name: string | null;
    /** Id of the user's role. */
    roleId: string;
    /** Account status (e.g. `active`). */
    status: string;
    /** Permission keys the user's role grants (e.g. `workspaces:create`). */
    permissions: string[];
};

/**
 * Who an invite link is for, as returned by `GET /api/auth/invite/:token`. The
 * inviting admin already chose both, so the accept screen shows them back
 * rather than asking for them.
 */
export type InviteDetails = {
    /** The email the invite was addressed to. */
    email: string;
    /** The display name the admin set, or `null` when they set none. */
    name: string | null;
};

/**
 * What the accept-invite form submits. The password is typed twice — the field
 * being set is the one thing the invitee cannot recover if they mistype it.
 */
export type AcceptInviteInput = {
    /** The raw one-time token lifted from the invite link's `?token=`. */
    token: string;
    /** The password to set as this account's first credential. */
    password: string;
    /** Re-typed password; must equal `password`. */
    confirmPassword: string;
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
