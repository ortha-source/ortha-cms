import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';

const EMAIL = 'throttle-proxy@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The login rate limit as a deployment **behind a load balancer** sees it —
 * `trust proxy` set to one hop, so `req.ip` is the client's address from
 * `X-Forwarded-For` rather than the proxy's.
 *
 * Without that setting every request through a proxy reports the same address,
 * so the whole deployment shares one bucket and one attacker's ten requests a
 * minute deny login to every user (BUG-identity-server-02). These assertions
 * are what tells the two postures apart: distinct forwarded clients get
 * distinct buckets, and exhausting one leaves the others untouched.
 *
 * A separate file from `login-throttle.spec.ts` because `closeTestApp` ends the
 * per-file database pool — two apps in one file would have the first one's
 * teardown pull the connection out from under the second. Jest isolates module
 * registries per file, so each gets its own pool.
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
        // Burn a third client's quota, then prove a fourth still reaches the
        // credential check and signs in.
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

    it('records the forwarded client IP on the session, not the proxy’s', async () => {
        // The same setting decides what `sessions.ip_address` stores. Behind an
        // untrusted proxy every row read `::1`, which is what made the session
        // list useless for spotting an unfamiliar sign-in.
        const admin = await seedActiveUser(harness.app, {
            email: 'throttle-proxy-admin@example.com',
            password: PASSWORD,
            role: 'admin'
        });
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .set('X-Forwarded-For', '203.0.113.42')
            .send({ email: admin.email, password: PASSWORD })
            .expect(201);

        const sessions = await agent
            .get(`/api/users/${admin.id}/sessions`)
            .expect(200);
        expect(sessions.body[0].ipAddress).toBe('203.0.113.42');
    });
});
