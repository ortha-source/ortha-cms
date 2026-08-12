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
 * Rate limiting on `POST /api/auth/login`. Both suites boot a dedicated app
 * with the limit pinned low (3 per window) so the throttled response is
 * deterministic; other suites run with a relaxed limit. The throttle is
 * per-app and in-memory, so it doesn't bleed into them.
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
        // `trustProxy` is unset here, matching a directly-exposed server. A
        // client-supplied forwarded header must NOT mint a fresh bucket, or the
        // limit would be one header away from bypassable.
        await attempt().set('X-Forwarded-For', '203.0.113.7').expect(429);
    });
});

/**
 * The same limit, but booted the way a deployment behind a load balancer is —
 * `trust proxy` set to one hop, so `req.ip` is the **client's** address from
 * `X-Forwarded-For` rather than the proxy's.
 *
 * Without that setting every request through a proxy reports the same address,
 * so the whole deployment shares one bucket and one attacker's quota locks out
 * every user (BUG-identity-server-02). These assertions are what tells the two
 * postures apart: distinct forwarded clients must get distinct buckets, and
 * exhausting one must leave the others untouched.
 */
describe('POST /api/auth/login (rate limit behind a trusted proxy)', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp({
            rateLimit: { ttlSeconds: 60, limit: 3 },
            trustProxy: 1
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

    /** One failed login attributed to `ip` via the forwarded header. */
    const attemptFrom = (ip: string) =>
        request(harness.server)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ip)
            .send({ email: EMAIL, password: 'wrong-on-purpose' });

    it('buckets per forwarded client IP', async () => {
        await attemptFrom('203.0.113.1').expect(401);
        await attemptFrom('203.0.113.1').expect(401);
        await attemptFrom('203.0.113.1').expect(401);
        await attemptFrom('203.0.113.1').expect(429);

        // A different client is unaffected — the exhausted bucket is that one
        // client's, not the proxy's.
        await attemptFrom('198.51.100.9').expect(401);
    });

    it('does not let a second client inherit the first client’s exhaustion', async () => {
        // Burn a third client's quota, then prove a fourth still authenticates
        // all the way to the credential check.
        await attemptFrom('192.0.2.5').expect(401);
        await attemptFrom('192.0.2.5').expect(401);
        await attemptFrom('192.0.2.5').expect(401);
        await attemptFrom('192.0.2.5').expect(429);

        await request(harness.server)
            .post('/api/auth/login')
            .set('X-Forwarded-For', '192.0.2.6')
            .send({ email: EMAIL, password: PASSWORD })
            .expect(201);
    });
});
