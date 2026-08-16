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
 * `trustProxy` set. They are separate files for readability; a second app in one
 * file is safe now that `closeTestApp` clears the database memo as well as
 * ending the pool.
 *
 * A **fresh app per test**, not per file: the throttler's bucket is in-memory
 * per app, so a `beforeAll` boot leaves the second test running against a bucket
 * the first one consumed. That made each test's expected status depend on the
 * one before it — the suite passed as a whole and failed under `-t`, which is
 * the shape of order-dependence that is hardest to diagnose and easiest to
 * mistake for a product bug.
 */
describe('POST /api/auth/login (rate limit)', () => {
    let harness: TestApp;

    beforeEach(async () => {
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

    afterEach(async () => {
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
        //
        // The bucket is exhausted here rather than inherited from the test
        // above, so this asserts what it claims to on its own.
        await attempt().expect(401);
        await attempt().expect(401);
        await attempt().expect(401);
        await attempt().set('X-Forwarded-For', '203.0.113.7').expect(429);
    });
});
