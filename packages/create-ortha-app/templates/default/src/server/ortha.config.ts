/**
 * Typed configuration for this app.
 *
 * **The single place that reads `process.env`.** Everything downstream — the
 * host, every plugin — receives typed values, so "where does this setting come
 * from" has exactly one answer. Deploy-specific values come from the
 * environment; stable product tuning lives here as literals.
 */
import { join } from 'node:path';
import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { IdentityPluginConfig } from '@orthacms/identity-server';
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { MediaPluginConfig } from '@orthacms/media-server';
import type { LocalStorageConfig } from '@orthacms/media-provider-local';

/** Root configuration for this app. */
export interface OrthaConfig {
    port: number;
    globalPrefix: string;
    trustProxy?: TrustProxySetting;
    bodyLimit?: string | number;
    staticDir?: string;
    database: { url: string };
    docs: ApiDocsOptions;
    plugins: {
        identity: IdentityPluginConfig;
        i18n: I18nPluginConfig;
        media: MediaPluginConfig & {
            /**
             * Settings for the storage backend `plugins.ts` constructs. Typed
             * by the factory it imports — swap `createLocalStorageProvider` for
             * another and this type swaps with it.
             */
            storage: LocalStorageConfig;
        };
    };
}

/**
 * Reads a value the app cannot run without, failing at load rather than
 * several seconds into boot.
 *
 * Allowed to default to `''`, a missing `DATABASE_URL` reaches `pg` as "use
 * the libpq defaults" — so the first query fails with whatever the local
 * environment happens to produce, and nothing in the message names the
 * variable nobody set.
 */
function requireEnv(name: string): string {
    const raw = process.env[name]?.trim();
    if (!raw) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
                'Set it in your .env before starting the app.'
        );
    }
    return raw;
}

/**
 * A numeric setting: the default when unset, the value when it is a plain
 * positive integer, and an error otherwise.
 *
 * Deliberately not `Number(process.env[x]) || fallback`, which is wrong in
 * three directions and silent in all of them: `0` is falsy so it becomes the
 * default, a negative is truthy so it is accepted (a negative session TTL
 * issues every session already expired), and `1e9` parses.
 */
function readPositiveInt(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;

    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error(
            `Environment variable ${name} must be a positive whole number ` +
                `(got "${raw}").`
        );
    }
    return Number(raw);
}

/**
 * Express's `trust proxy` setting: a hop count (the recommended form, and the
 * only one a client cannot forge past), a boolean, or a subnet/preset string
 * passed through verbatim. Unset leaves forwarded headers ignored.
 */
function readTrustProxy(): TrustProxySetting | undefined {
    const raw = process.env['TRUST_PROXY']?.trim();
    if (!raw) return undefined;

    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 0) return hops;
    if (raw === 'true' || raw === 'false') return raw === 'true';

    return raw;
}

/**
 * True only in a deployment that said so, spelling checked.
 *
 * This one comparison gates two protections at once — whether the API
 * reference is published, and whether the session cookie carries `Secure` — so
 * a typo silently turns both off and is indistinguishable from correct
 * configuration until you read a `Set-Cookie` header.
 */
const NODE_ENVS = ['development', 'test', 'production'] as const;
const nodeEnv = process.env['NODE_ENV']?.trim();

if (nodeEnv && !(NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    throw new Error(
        `NODE_ENV is "${nodeEnv}", which this app does not recognise — expected ` +
            `one of ${NODE_ENVS.join(', ')}, or nothing at all for local ` +
            'development. Anything else reads as "not production", which ' +
            'publishes the API reference and drops `Secure` from the session cookie.'
    );
}

const isProduction = nodeEnv === 'production';

const config: OrthaConfig = {
    port: readPositiveInt('PORT', 3000),
    globalPrefix: 'api',
    trustProxy: readTrustProxy(),
    bodyLimit: process.env['MAX_REQUEST_BODY'] || '1mb',
    // The built admin bundle, served by this same process so the API and the
    // UI share one origin — which is what identity's httpOnly, SameSite=lax
    // session cookie needs. `ortha dev` uses Vite's proxy for the same effect.
    //
    // Relative to the app root: `ortha start` runs from there, and this path
    // must mean the same thing whether it is read from `dist/` or from source.
    staticDir: join(process.cwd(), 'dist/admin'),
    database: {
        url: requireEnv('DATABASE_URL')
    },
    docs: {
        // On outside production, where the reference is a development tool.
        // `API_DOCS=true` publishes it from a deployed instance.
        enabled: process.env['API_DOCS']
            ? process.env['API_DOCS'] === 'true'
            : !isProduction,
        title: '__APP_TITLE__ API',
        version: '1.0.0'
    },
    plugins: {
        identity: {
            sessionSecret: process.env['SESSION_SECRET'] ?? '',
            tokenSecret: process.env['TOKEN_SECRET'] ?? '',
            // Origins allowed to make state-changing calls (login-CSRF
            // defence). In development that is the Vite dev server; in
            // production the app is same-origin, so this list is what a
            // separately-hosted admin would need adding to.
            allowedOrigins: (
                process.env['ALLOWED_ORIGINS'] ??
                `http://localhost:${readPositiveInt('ADMIN_PORT', 4200)}`
            )
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
            session: {
                ttlSeconds: readPositiveInt(
                    'SESSION_TTL_SECONDS',
                    60 * 60 * 24 * 7
                ),
                cookieSecure: isProduction,
                cookieSameSite: 'lax'
            },
            token: {
                inviteTtlSeconds: readPositiveInt(
                    'INVITE_TTL_SECONDS',
                    60 * 60 * 24 * 7
                ),
                resetTtlSeconds: readPositiveInt('RESET_TTL_SECONDS', 60 * 60)
            },
            rateLimit: {
                ttlSeconds: readPositiveInt('LOGIN_RATE_LIMIT_TTL_SECONDS', 60),
                limit: readPositiveInt('LOGIN_RATE_LIMIT', 10)
            },
            // With an email set, an admin is provisioned on boot — idempotent
            // and non-destructive. This is how you get your first login.
            rootAdmin: {
                email: process.env['ORTHA_ROOT_ADMIN_EMAIL'] ?? '',
                password: process.env['ORTHA_ROOT_ADMIN_PASSWORD'] ?? '',
                name: process.env['ORTHA_ROOT_ADMIN_NAME'] ?? ''
            }
        },
        i18n: {
            // Content locales. Stable product configuration, hence literals.
            // The slugs are stored on entry rows, so removing one hides its
            // rows rather than deleting them — which is what `orphanedLocales`
            // is about below.
            locales: [{ slug: 'en', name: 'English', isDefault: true }],
            // Rows in a locale no longer listed above are intact and
            // unreachable, the worst shape for a silent failure. Fail the boot
            // and put the choice in front of whoever edited the array.
            orphanedLocales: 'fail'
        },
        media: {
            storage: {
                // Point MEDIA_LOCAL_ROOT at a persistent volume in production:
                // a container's own disk is wiped on every deploy.
                rootDir: process.env['MEDIA_LOCAL_ROOT'] ?? './.storage/media'
            },
            maxUploadBytes: readPositiveInt(
                'MEDIA_MAX_UPLOAD_BYTES',
                50 * 1024 * 1024
            )
        }
    }
};

export default config;
