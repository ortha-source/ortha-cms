import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';

const EMAIL = 'throttle-test@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * Rate limiting on `POST /api/auth/login`, with **no proxy trusted** — a
 * directly-exposed server. This suite boots a dedicated app with the limit
 * pinned low (3 per window) so the throttled response is deterministic; other
 * suites run with a relaxed limit. The throttle is per-app and in-memory, so it
 * doesn't bleed into them.
 *
 * Its sibling `login-throttle-proxy.spec.ts` boots the same limit with
 * `trustProxy` set. They are separate files on purpose: `closeTestApp` ends the
 * per-file `@ortha-cms/database` pool, so two apps in one file would have the
 * first one's teardown pull the connection out from under the second.
 */
describe('POST /api/auth/login (rate limit)', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp({
            rateLimit: { ttlSeconds: 60, limit: 3 }
        });
        await resetDb();
        await seedActiveUser(harness.app, {
            email: EMAIL,
            password: PASSWORD,
            role: 'viewer'
        });
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    const attempt = () =>
        request(harness.server)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: 'wrong-on-purpose' });

    it('returns 429 once the limit is exceeded', async () => {
        // The guard counts every request, success or failure. With limit=3,
        // the first three pass through (401 here), the fourth is throttled.
        await attempt().expect(401);
        await attempt().expect(401);
        await attempt().expect(401);
        await attempt().expect(429);
    });

    it('ignores a spoofed X-Forwarded-For when no proxy is trusted', async () => {
        // A client-supplied forwarded header must NOT mint a fresh bucket, or
        // the limit would be one header away from bypassable. Express ignores
        // the header entirely until `trust proxy` is set — which is the safe
        // half of BUG-identity-server-02, and why the fix is opt-in per
        // deployment rather than on by default.
        await attempt().set('X-Forwarded-For', '203.0.113.7').expect(429);
    });
});
