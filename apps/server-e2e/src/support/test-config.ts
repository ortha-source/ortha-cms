import type {
    IdentityRateLimitConfig,
    IdentityRootAdminConfig
} from '@ortha-cms/identity-server';
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
    /** Replace the allow-listed origins. */
    allowedOrigins?: string[];
    /**
     * Configure the root-admin bootstrap. Omitted by default, so the seeder
     * is a no-op and a freshly booted app has no users (matching production
     * with no `ORTHA_ROOT_ADMIN_EMAIL` set).
     */
    rootAdmin?: IdentityRootAdminConfig;
}

export function buildTestConfig(
    connectionString: string,
    overrides: TestConfigOverrides = {}
): OrthaConfig {
    return {
        port: 0,
        globalPrefix: 'api',
        database: { url: connectionString },
        // `createTestApp` builds the app itself and never calls `setupApiDocs`,
        // so this is only here to satisfy the config contract — stated
        // explicitly so a reader doesn't wonder whether the suites serve docs.
        docs: { enabled: false },
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
                locales: [
                    { slug: 'en', name: 'English', isDefault: true },
                    { slug: 'de', name: 'Deutsch' },
                    { slug: 'fr', name: 'Français' }
                ]
            },
            // The media plugin registers an in-memory `memory` provider in
            // `buildTestPlugins`, so uploads never touch disk. `defaultProvider`
            // names it; local/s3 settings are unused in tests.
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
                    ollama: { baseUrl: 'http://localhost:1', models: ['unused'] }
                }
            },
            media: {
                defaultProvider: 'memory',
                local: {
                    rootDir: './.storage/test-media',
                    publicBasePath: '/api/media/assets'
                },
                s3: { bucket: '', region: '' },
                maxUploadBytes: 52_428_800
            },
            // `buildTestPlugins` registers no copilot plugin, so this exists
            // only to satisfy the `OrthaConfig` contract — same reason as
            // `docs` above. Disabled and pointed at no real backend: a suite
            // must never reach a model provider, and empty credentials make
            // that a connection error rather than a silent live call.
            copilot: {
                enabled: false,
                defaultProvider: 'fake',
                maxOutputTokens: 1024,
                providers: {
                    claude: { apiKey: '', models: [] },
                    ollama: { baseUrl: '', models: [] }
                }
            }
        }
    };
}
