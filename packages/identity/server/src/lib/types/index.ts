/**
 * Configuration for the identity plugin. Origins and lifetimes are supplied by
 * the host (see `apps/server/ortha.config.ts`) — identity never reads
 * `process.env`. Part of the package's public, SemVer'd API.
 *
 * **There is no signing secret here, and that is not an omission.** Sessions
 * and one-time tokens are opaque 256-bit CSPRNG values checked against a row,
 * not signed blobs — so there is no key to configure and revocation is a
 * delete. It previously carried `sessionSecret` and `tokenSecret`, declared as
 * required and read by nothing: an operator generated two high-entropy values,
 * stored them in a secret manager, and put "rotate the session secret" in their
 * runbook, all of it inert. On a real incident they would rotate, observe that
 * live sessions survived, and reasonably conclude the rotation had failed —
 * when in fact the remedy is deleting session rows.
 */
export interface IdentityPluginConfig {
    /**
     * Browser origins permitted to call state-changing endpoints (e.g. the
     * admin app's origin). Checked by `OriginGuard` as a login-CSRF defense;
     * requests with no `Origin` header (non-browser clients) are allowed.
     */
    allowedOrigins: string[];
    /** Session cookie + lifetime settings. */
    session: IdentitySessionConfig;
    /** One-time token lifetimes. */
    token: IdentityTokenConfig;
    /**
     * Rate limit for sensitive endpoints (`/auth/login`). Optional — when
     * omitted, defaults to 10 requests per 60s. Exposed so deployments can
     * tune it and tests can relax it (a high limit) or pin it low to assert
     * the throttled (429) path.
     */
    rateLimit?: IdentityRateLimitConfig;
    /**
     * Env-provisioned root administrator (self-hosted bootstrap). The seeder
     * validates it: an empty {@link IdentityRootAdminConfig.email} skips the
     * bootstrap, an email without a password fails boot. When provisioned, an
     * `active` user holding the `admin` role is ensured — idempotent and
     * non-destructive (an already-present email is left untouched).
     */
    rootAdmin?: IdentityRootAdminConfig;
    /**
     * Single sign-on settings. Absent when the deployment registers no SSO
     * providers, which is the default install.
     *
     * The **providers themselves are not here.** They are constructed adapters,
     * and they are passed to `IdentityPlugin`'s second argument at the
     * composition root — the same split the copilot makes between
     * `plugins.copilot.providers` (connection settings, read from the
     * environment) and `CopilotPlugin({ providers })` (built adapters). This
     * object is the typed view of the environment; an adapter instance is not
     * an environment value.
     */
    sso?: IdentitySsoConfig;
}

/** Deployment settings for the SSO routes. Every field has a usable default. */
export interface IdentitySsoConfig {
    /**
     * The origin browsers reach this API on, e.g. `https://cms.acme.com`.
     *
     * Used to build the `redirect_uri` registered with each identity provider.
     * Configured rather than read from the request's `Host` header, which a
     * client controls and could therefore point at an origin of its choosing.
     *
     * Defaults to the first entry of {@link IdentityPluginConfig.allowedOrigins},
     * which is correct whenever the admin and the API share an origin — the
     * ordinary deployment, and the dev setup where Vite proxies `/api`.
     */
    publicBaseUrl?: string;
    /**
     * The API's global route prefix, if the host changed it from `/api`. It is
     * part of the callback URL, and most identity providers match that string
     * exactly.
     */
    apiPathPrefix?: string;
    /** Where the admin serves its sign-in screen. Defaults to `/identity/signin`. */
    signInPath?: string;
    /**
     * How long one sign-in attempt stays live, in seconds. Defaults to 600 —
     * long enough for a consent screen and a second factor, short enough that a
     * forgotten tab is not an open credential.
     */
    requestTtlSeconds?: number;
}

/**
 * Root-admin bootstrap settings. The host supplies a plaintext password; the
 * seeder bcrypt-hashes it (with a per-account random salt) before storage, so
 * plaintext never reaches the database.
 */
export interface IdentityRootAdminConfig {
    /** Login email of the root admin to provision. Stored lower-cased. */
    email: string;
    /** Plaintext password; bcrypt-hashed before it touches the database. */
    password: string;
    /** Optional display name; set only when the account is first created. */
    name?: string;
}

/** Rate-limit settings for sensitive endpoints. */
export interface IdentityRateLimitConfig {
    /** Sliding-window length, in seconds. */
    ttlSeconds: number;
    /** Maximum requests permitted per window, per client IP. */
    limit: number;
}

/** Session cookie and lifetime settings. */
export interface IdentitySessionConfig {
    /** Session lifetime, in seconds. */
    ttlSeconds: number;
    /** `secure` cookie attribute — true behind HTTPS (production). */
    cookieSecure: boolean;
    /**
     * `sameSite` cookie attribute. Assumes a same-origin deployment
     * (admin served behind the same origin / a dev proxy). See the
     * cross-origin note in CLAUDE.md — owned by the login ticket (#8).
     */
    cookieSameSite: 'lax' | 'strict' | 'none';
}

/** One-time token lifetimes. */
export interface IdentityTokenConfig {
    /** Invitation token lifetime, in seconds. */
    inviteTtlSeconds: number;
    /** Password-reset token lifetime, in seconds. */
    resetTtlSeconds: number;
}
