/**
 * Configuration for the identity plugin. Secrets and lifetimes are
 * supplied by the host (see `apps/server/ortha.config.ts`) — identity
 * never reads `process.env`. Part of the package's public, SemVer'd API.
 */
export interface IdentityPluginConfig {
    /** Secret used to sign server-side session cookies. */
    sessionSecret: string;
    /**
     * Browser origins permitted to call state-changing endpoints (e.g. the
     * admin app's origin). Checked by `OriginGuard` as a login-CSRF defense;
     * requests with no `Origin` header (non-browser clients) are allowed.
     */
    allowedOrigins: string[];
    /**
     * Secret used to sign one-time invite/reset tokens. Kept distinct
     * from {@link IdentityPluginConfig.sessionSecret} so a leaked token
     * secret cannot be used to forge sessions.
     */
    tokenSecret: string;
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
