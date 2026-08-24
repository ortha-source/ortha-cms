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
 * Whose password a reset link sets, as returned by
 * `GET /api/auth/reset/:token`. Shown on the reset screen so the person
 * following a link handed to them out-of-band can confirm it is for the right
 * account before they commit a password to it.
 */
export type PasswordResetDetails = {
    /** The email of the account the link resets. */
    email: string;
    /** The account's display name, or `null` when it has none. */
    name: string | null;
};

/**
 * What the reset form submits. The password is typed twice — the link is
 * single-use, so a mistyped password cannot be corrected by opening it again.
 */
export type ResetPasswordInput = {
    /** The raw one-time token lifted from the reset link's `?token=`. */
    token: string;
    /** The password to set as this account's credential. */
    password: string;
    /** Re-typed password; must equal `password`. */
    confirmPassword: string;
};

/**
 * One single sign-on provider the deployment offers, as returned by
 * `GET /api/auth/sso`.
 *
 * Carries nothing about any particular person — no "this address uses Google".
 * The endpoint answers before anyone has identified themselves, and one that
 * varied by email would be an account-enumeration oracle wearing a helpful
 * face.
 */
export type SsoProviderSummary = {
    /** The registered name, used in the sign-in URL. */
    name: string;
    /** The button label the operator chose. */
    label: string;
    /** The protocol the provider speaks. */
    kind: 'oidc' | 'oauth2' | 'saml';
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
