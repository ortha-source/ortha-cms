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
    /**
     * Request budget one **API token** may spend per window, across every
     * protocol the public API is served over — REST, GraphQL and MCP share one
     * bucket per credential (see `ApiTokenRateLimiter`). Optional; when
     * omitted, defaults to 300 requests per 60s. Set `limit: 0` to turn it off
     * for a deployment that limits at its own gateway.
     */
    apiTokenRateLimit?: ApiTokenRateLimitConfig;
    /**
     * Env-provisioned root administrator (self-hosted bootstrap). The seeder
     * validates it: an empty {@link IdentityRootAdminConfig.email} skips the
     * bootstrap, an email without a password fails boot. When provisioned, an
     * `active` user holding the `admin` role is ensured — idempotent and
     * non-destructive (an already-present email is left untouched).
     */
    rootAdmin?: IdentityRootAdminConfig;
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

/**
 * The per-credential budget on the public API.
 *
 * Distinct from {@link IdentityRateLimitConfig}, which buckets `/auth/login` on
 * the **client address**: an API token is a stable identifier the caller cannot
 * change by moving hosts, so the two are tuned independently and neither
 * default has anything to say about the other. A public content API serves
 * build pipelines and edge caches that burst, so its ceiling is an order of
 * magnitude higher than the login one.
 */
export interface ApiTokenRateLimitConfig {
    /** Window length, in seconds. */
    ttlSeconds: number;
    /**
     * Maximum requests permitted per window, per token. `0` disables the limit
     * entirely — for a deployment that enforces one in front of the app.
     */
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
