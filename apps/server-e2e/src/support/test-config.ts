import type { IdentityRateLimitConfig } from '@ortha-cms/identity-server';
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
}

export function buildTestConfig(
    connectionString: string,
    overrides: TestConfigOverrides = {}
): OrthaConfig {
    return {
        port: 0,
        globalPrefix: 'api',
        database: { url: connectionString },
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
                rateLimit: overrides.rateLimit ?? RELAXED_RATE_LIMIT
            }
        }
    };
}
