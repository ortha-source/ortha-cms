import type { TrustProxySetting } from '@ortha-cms/bootstrap-server';
import type { ContentGraphqlLimits } from '@ortha-cms/content-graphql';
import type {
    IdentityRateLimitConfig,
    IdentityRootAdminConfig
} from '@ortha-cms/identity-server';
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
    /** Replace the allow-listed origins. */
    allowedOrigins?: string[];
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
     * Turn developer tooling on. `createTestApp` never mounts the Scalar
     * reference, so this exists for the one thing that reads the same flag: the
     * GraphiQL playground, whose whole security story is that it is off unless
     * a deployment asks.
     */
    docsEnabled?: boolean;
    /**
     * Turn the MCP endpoint off, to assert that the kill switch really
     * unmounts it. Enabled by default so the suites can drive it.
     */
    mcpEnabled?: boolean;
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
        database: { url: connectionString },
        // `createTestApp` builds the app itself and never calls `setupApiDocs`,
        // so this mounts no Scalar reference. It is NOT inert, though: the
        // GraphQL plugin reads the same flag to decide whether to register the
        // GraphiQL playground, which is what `docsEnabled` exists to flip.
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
                    cookieSameSite: 'lax'
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
                enabled: true,
                defaultProvider: 'fake',
                maxOutputTokens: 1024,
                providers: {
                    claude: { apiKey: '', models: ['unused'] },
                    ollama: {
                        baseUrl: 'http://localhost:1',
                        models: ['unused']
                    }
                }
            },
            // The media plugin registers an in-memory `memory` provider in
            // `buildTestPlugins`, so uploads never touch disk. `defaultProvider`
            // names it; local/s3 settings are unused in tests.
            media: {
                defaultProvider: 'memory',
                local: {
                    rootDir: './.storage/test-media',
                    publicBasePath: '/api/media/assets'
                },
                s3: { bucket: '', region: '' },
                maxUploadBytes: 52_428_800
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
                version: '0.0.0-test'
            }
        }
    };
}
