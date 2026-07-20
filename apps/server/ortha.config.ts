/**
 * Typed application configuration for the Ortha CMS server.
 *
 * This is the single place that reads `process.env`. Everything
 * downstream (`createServer`, plugins) receives typed config — nothing
 * else should reach for environment variables directly. Deploy-specific
 * values come from the environment; stable tuning lives here as literals.
 */

import type { IdentityPluginConfig } from '@ortha-cms/identity-server';
import type { I18nPluginConfig } from '@ortha-cms/i18n-server';
import type { MediaPluginConfig } from '@ortha-cms/media-server';

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
        /** i18n plugin settings — the available content locales. */
        i18n: I18nPluginConfig;
        /** Media plugin settings — storage providers + upload limits. */
        media: MediaPluginConfig;
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
            },
            // Login rate limit. Defaults preserve the historical 10 req / 60s.
            rateLimit: {
                ttlSeconds:
                    Number(process.env['LOGIN_RATE_LIMIT_TTL_SECONDS']) || 60,
                limit: Number(process.env['LOGIN_RATE_LIMIT']) || 10
            },
            rootAdmin: {
                email: process.env['ORTHA_ROOT_ADMIN_EMAIL'] ?? '',
                password: process.env['ORTHA_ROOT_ADMIN_PASSWORD'] ?? '',
                name: process.env['ORTHA_ROOT_ADMIN_NAME'] ?? ''
            }
        },
        i18n: {
            // Content locales — stable product configuration, so literals
            // (like the rest of the non-secret tuning here). The slugs are
            // stored on entry rows; the migration backfill assumes 'en' is
            // the default.
            locales: [
                { slug: 'en', name: 'English', isDefault: true },
                { slug: 'de', name: 'Deutsch' },
                { slug: 'fr', name: 'Français' }
            ]
        },
        media: {
            // The provider the resolver falls back to when no custom handler is
            // supplied in `plugins.ts`. Deploy-specific; defaults to local disk.
            defaultProvider: process.env['MEDIA_PROVIDER'] ?? 'local',
            local: {
                // Blobs live under a git-ignored project dir by default; point
                // MEDIA_LOCAL_ROOT at a persistent volume for real deployments.
                rootDir: process.env['MEDIA_LOCAL_ROOT'] ?? './.storage/media',
                publicBasePath: '/api/media/assets'
            },
            s3: {
                bucket: process.env['MEDIA_S3_BUCKET'] ?? '',
                region: process.env['MEDIA_S3_REGION'] ?? ''
            },
            // Upload cap — 50 MB by default.
            maxUploadBytes:
                Number(process.env['MEDIA_MAX_UPLOAD_BYTES']) || 52_428_800
        }
    }
};

export default config;
