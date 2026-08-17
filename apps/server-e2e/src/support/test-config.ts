import type { TrustProxySetting } from '@ortha-cms/bootstrap-server';
import type { ContentGraphqlLimits } from '@ortha-cms/content-graphql';
import type {
    IdentityRateLimitConfig,
    IdentityRootAdminConfig,
    IdentitySessionConfig
} from '@ortha-cms/identity-server';
import type { RunLimits } from '@ortha-cms/copilot-domain';
import type { LocaleDef, OrphanedLocalePolicy } from '@ortha-cms/i18n-server';
import type { OrthaConfig } from '../../../server/ortha.config';

/**
 * The host config the e2e app boots with. Mirrors `apps/server/ortha.config.ts`
 * but with deterministic test values and the testcontainer's connection
 * string — so we exercise the real plugin wiring (`buildPlugins`) without
 * depending on the developer's `.env`.
 *
 * `cookieSecure: false` so the session cookie survives plain-HTTP supertest
 * requests; `allowedOrigins` is the dev admin origin, used by the OriginGuard
 * tests.
 */
export const TEST_ALLOWED_ORIGIN = 'http://localhost:4200';

/**
 * Rate limit relaxed by default so a large login suite doesn't self-throttle.
 * The throttle suite overrides this with a low limit to assert the 429 path.
 */
const RELAXED_RATE_LIMIT: IdentityRateLimitConfig = {
    ttlSeconds: 60,
    limit: 1000
};

/** Per-app config tweaks an individual suite may need. */
export interface TestConfigOverrides {
    /** Replace the login rate limit (e.g. pin it low to test throttling). */
    rateLimit?: IdentityRateLimitConfig;
    /**
     * Express `trust proxy`. Unset by default (matching a directly-exposed
     * server, where `X-Forwarded-For` is ignored); the throttle suite boots a
     * second app with it set to prove the rate limit then buckets per
     * forwarded client IP rather than collapsing to one global bucket.
     */
    trustProxy?: TrustProxySetting;
    /**
     * Shrink the request-body cap, so a suite can prove the `413` boundary
     * without shipping a megabyte of fixture — and, more to the point, prove
     * the cap is read from **this config** at all rather than inherited from
     * `express.json()`'s 100 kB default, which is what it used to be.
     */
    bodyLimit?: string | number;
    /** Replace the allow-listed origins. */
    allowedOrigins?: string[];
    /**
     * Override the session-cookie attributes.
     *
     * The default is the plain-HTTP shape supertest needs (`cookieSecure:
     * false`), and for a long time that was the *only* shape reachable — which
     * left the production configuration, where `Secure` is the whole point,
     * asserted nowhere. A suite can now boot the deployed shape and check the
     * `Set-Cookie` header really carries it.
     */
    session?: Partial<IdentitySessionConfig>;
    /**
     * Configure the root-admin bootstrap. Omitted by default, so the seeder
     * is a no-op and a freshly booted app has no users (matching production
     * with no `ORTHA_ROOT_ADMIN_EMAIL` set).
     */
    rootAdmin?: IdentityRootAdminConfig;
    /**
     * Tighten the GraphQL cost budget, so a suite can prove a limit trips
     * without having to author a genuinely enormous document.
     */
    graphqlLimits?: Partial<ContentGraphqlLimits>;
    /**
     * Turn developer tooling on. Two things ride this one flag, and both have
     * the same security story — off unless a deployment asks: the Scalar API
     * reference (`setupApiDocs`, mounted by `createTestApp` exactly as
     * `createServer` mounts it) and the GraphiQL playground.
     */
    docsEnabled?: boolean;
    /**
     * Turn the MCP endpoint off, to assert that the kill switch really
     * unmounts it. Enabled by default so the suites can drive it.
     */
    mcpEnabled?: boolean;
    /**
     * Shorten the MCP per-call deadline, so a suite can prove a hung tool is
     * abandoned without waiting the production 30 seconds for it.
     */
    mcpCallTimeoutMs?: number;
    /**
     * Lower the MCP result ceiling, so a suite can prove the `result_too_large`
     * refusal without producing four megabytes of content to trip it.
     */
    mcpMaxResultBytes?: number;
    /**
     * Lower the media upload cap, so a suite can prove the 413 without
     * shipping a 50 MB fixture — and, more to the point, prove the cap is read
     * from **this config** at all. It used to be a module-level
     * `process.env['MEDIA_MAX_UPLOAD_BYTES']` read inside the upload
     * controllers, which made `plugins.media.maxUploadBytes` inert: an override
     * here changed nothing.
     */
    maxUploadBytes?: number;
    /**
     * Route uploads through the **real** filesystem provider, rooted here,
     * instead of the in-memory one.
     *
     * The harness stores blobs in a `Map` on purpose — no suite should need a
     * disk to test an HTTP contract. The exception is the handful of claims
     * that are *about* the disk: that a blob lands where its key says, that a
     * delete reclaims the directory as well as the file, and that a
     * `storage_key` read back from the database cannot walk out of the storage
     * root. None of those can be observed through a `Map`.
     */
    localMediaRoot?: string;
    /**
     * Replace the configured content locales. Defaults to the host's
     * en/de/fr. A suite pins a **single** locale to prove the coverage rule
     * that `notLocalized` is then forced to `0` — with nowhere to translate
     * to, every record would otherwise be reported as both fully localized and
     * not localized at all, and no combination of seeded data can produce that
     * situation while three locales are configured.
     */
    locales?: LocaleDef[];
    /**
     * Override the copilot's kill switch and run ceilings.
     *
     * The ceilings are the reason this exists: `RunLimits` bounds a run three
     * ways and the defaults (8 steps, two minutes, 120 k tokens) are all far
     * out of reach of a scripted fake, so a suite that wants to see a ceiling
     * trip has to lower it. `enabled` is here for the other half of the same
     * argument — the disabled path answers with an error frame rather than a
     * 403, and that shape has no other way to be reached.
     */
    copilot?: {
        enabled?: boolean;
        maxOutputTokens?: number;
        limits?: Partial<RunLimits>;
    };
    /**
     * How the plugin reacts at boot to rows in an unconfigured locale.
     * `'warn'` here by default rather than the shipped `'fail'`: a suite that
     * seeds such a row on purpose is testing that the rest of the system
     * excludes it, and the app it seeds into has already booted.
     */
    orphanedLocales?: OrphanedLocalePolicy;
}

export function buildTestConfig(
    connectionString: string,
    overrides: TestConfigOverrides = {}
): OrthaConfig {
    return {
        port: 0,
        globalPrefix: 'api',
        trustProxy: overrides.trustProxy,
        // The shipped default, so the parity suite asserts the real number.
        bodyLimit: overrides.bodyLimit ?? '1mb',
        database: { url: connectionString },
        // Read twice: `createTestApp` passes it to `setupApiDocs` (the Scalar
        // reference), and the GraphQL plugin reads it to decide whether to
        // register the GraphiQL playground. Off by default, as in production.
        docs: { enabled: overrides.docsEnabled ?? false },
        plugins: {
            identity: {
                sessionSecret: 'test-session-secret',
                tokenSecret: 'test-token-secret',
                allowedOrigins: overrides.allowedOrigins ?? [
                    TEST_ALLOWED_ORIGIN
                ],
                session: {
                    ttlSeconds: 60 * 60 * 24 * 7,
                    cookieSecure: false,
                    cookieSameSite: 'lax',
                    ...overrides.session
                },
                token: {
                    inviteTtlSeconds: 60 * 60 * 24 * 7,
                    resetTtlSeconds: 60 * 60
                },
                rateLimit: overrides.rateLimit ?? RELAXED_RATE_LIMIT,
                rootAdmin: overrides.rootAdmin
            },
            // The e2e content types (`test_article`, `test_author`,
            // `test_landing`) are i18n, so the i18n plugin must be configured to
            // boot — mirrors the host's en (default) / de / fr locales.
            i18n: {
                locales: overrides.locales ?? [
                    { slug: 'en', name: 'English', isDefault: true },
                    { slug: 'de', name: 'Deutsch' },
                    { slug: 'fr', name: 'Français' }
                ],
                orphanedLocales: overrides.orphanedLocales ?? 'warn'
            },
            // The copilot boots ENABLED in tests. Production defaults it off
            // (ADR-0005 §10) because enabling a hosted provider ships content
            // to a third party — but the e2e run's only provider is the
            // scripted fake, which makes no network call, so there is nothing
            // to opt into and everything to cover.
            copilot: {
                enabled: overrides.copilot?.enabled ?? true,
                defaultProvider: 'fake',
                maxOutputTokens: overrides.copilot?.maxOutputTokens ?? 1024,
                ...(overrides.copilot?.limits
                    ? { limits: overrides.copilot.limits }
                    : {}),
                providers: {
                    claude: { apiKey: '', models: ['unused'] },
                    ollama: {
                        baseUrl: 'http://localhost:1',
                        models: ['unused']
                    }
                }
            },
            // The media plugin registers an in-memory `memory` provider in
            // `buildTestPlugins`, so uploads never touch disk — unless a suite
            // asks for the real filesystem adapter with `localMediaRoot`, which
            // flips `defaultProvider` to the `local` one registered beside it.
            media: {
                defaultProvider: overrides.localMediaRoot ? 'local' : 'memory',
                local: {
                    rootDir:
                        overrides.localMediaRoot ?? './.storage/test-media',
                    publicBasePath: '/api/media/assets'
                },
                s3: { bucket: '', region: '' },
                maxUploadBytes: overrides.maxUploadBytes ?? 52_428_800
            },
            // The GraphQL endpoint's cost budget. Left at the shipped defaults
            // so the limit suite asserts the real numbers rather than
            // test-only ones — except the schema cache, pinned to 0 so a suite
            // that changes a workspace's content grants sees the new schema on
            // the very next request instead of racing a TTL.
            contentGraphql: {
                ...(overrides.graphqlLimits
                    ? { limits: overrides.graphqlLimits }
                    : {}),
                schemaCacheTtlMs: 0
            },
            // Enabled by default here (the host default is off): the endpoint
            // is what the MCP suites drive. `mcpEnabled: false` is how the
            // kill-switch suite asserts the controller is really unmounted.
            mcp: {
                enabled: overrides.mcpEnabled ?? true,
                name: 'ortha-cms-test',
                version: '0.0.0-test',
                callTimeoutMs: overrides.mcpCallTimeoutMs ?? 30_000,
                maxResultBytes: overrides.mcpMaxResultBytes ?? 4_194_304
            }
        }
    };
}
