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
 * Rate limiting on `POST /api/auth/login`. This suite boots a dedicated app
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
});
