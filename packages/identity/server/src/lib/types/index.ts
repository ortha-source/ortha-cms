import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Runtime dependencies the host supplies to the identity plugin. Identity
 * depends only on the Drizzle *client type* — never on `@ortha-cms/database`
 * (§5). The host, which owns the connection, provides the accessor.
 */
export interface IdentityPluginDeps {
    /**
     * Returns the live Drizzle client. A thunk, not the client itself, so it
     * resolves lazily — after `DatabasePlugin.onPluginInit` opens the
     * connection, never at plugin-construction time.
     */
    getDb: () => NodePgDatabase;
}

/**
 * Configuration for the identity plugin. Secrets and lifetimes are
 * supplied by the host (see `apps/server/ortha.config.ts`) — identity
 * never reads `process.env`. Part of the package's public, SemVer'd API.
 */
export interface IdentityPluginConfig {
    /** Secret used to sign server-side session cookies. */
    sessionSecret: string;
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
