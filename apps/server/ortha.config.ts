/**
 * Typed application configuration for the Ortha CMS server.
 *
 * This is the single place that reads `process.env`. Everything
 * downstream (`createServer`, plugins) receives typed config — nothing
 * else should reach for environment variables directly. Deploy-specific
 * values come from the environment; stable tuning lives here as literals.
 */

import type { IdentityPluginConfig } from '@ortha-cms/identity-server';

/** Database connection settings. */
export interface OrthaDatabaseConfig {
    /** PostgreSQL connection string. Sourced from `DATABASE_URL`. */
    url: string;
}

/** Root server configuration. */
export interface OrthaConfig {
    /** Port the API listens on. Sourced from `PORT`, defaults to 3000. */
    port: number;
    /** Global API route prefix. */
    globalPrefix: string;
    /** Database connection settings. */
    database: OrthaDatabaseConfig;
    /** Per-plugin runtime config, keyed by plugin name. */
    plugins: {
        /** Identity plugin settings. */
        identity: IdentityPluginConfig;
    };
}

const config: OrthaConfig = {
    port: Number(process.env['PORT']) || 3000,
    globalPrefix: 'api',
    database: {
        url: process.env['DATABASE_URL'] ?? ''
    },
    plugins: {
        identity: {
            // SECURITY: empty default is tolerated only while no signing
            // exists. #8 sessions are unsigned opaque tokens (DB-validated),
            // so sessionSecret stays unconsumed; add fail-fast validation when
            // a secret is first consumed for signing (#10 tokens).
            sessionSecret: process.env['SESSION_SECRET'] ?? '',
            tokenSecret: process.env['TOKEN_SECRET'] ?? '',
            // Origins allowed to call state-changing endpoints (login-CSRF
            // defense). Comma-separated; defaults to the dev admin origin.
            allowedOrigins: (
                process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:4200'
            )
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
            session: {
                ttlSeconds:
                    Number(process.env['SESSION_TTL_SECONDS']) ||
                    60 * 60 * 24 * 7,
                cookieSecure: process.env['NODE_ENV'] === 'production',
                cookieSameSite: 'lax'
            },
            token: {
                inviteTtlSeconds:
                    Number(process.env['INVITE_TTL_SECONDS']) ||
                    60 * 60 * 24 * 7,
                resetTtlSeconds:
                    Number(process.env['RESET_TTL_SECONDS']) || 60 * 60
            }
        }
    }
};

export default config;
