import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';

const EMAIL = 'throttle-shared@example.com';
const PASSWORD = 'SecurePass123!';
const LIMIT = { ttlSeconds: 60, limit: 3 };

/**
 * The login limit is the **deployment's**, not each process's.
 *
 * Its buckets used to be `@nestjs/throttler`'s in-process `Map`, so N API
 * instances behind a load balancer allowed N times the configured attempts per
 * window, and a restart forgot every block. They now live in Postgres
 * (`throttle_buckets`), counted by one upsert per request.
 *
 * Two instances are two apps over one database. They run **in sequence** —
 * the `@orthacms/database` handle is a module singleton, so two open at once in
 * one file is not something the harness supports — which is the stricter
 * version of the claim anyway: the second instance starts with nothing in
 * memory, so any count it sees can only have come from the shared store.
 */
describe('POST /api/auth/login (rate limit shared across instances)', () => {
    let harness: TestApp | undefined;

    afterEach(async () => {
        if (harness) await closeTestApp(harness);
        harness = undefined;
    });

    const attempt = (app: TestApp) =>
        request(app.server)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: 'wrong-on-purpose' });

    it('counts attempts made on one instance against the next [identity:I-31]', async () => {
        harness = await createTestApp({ rateLimit: LIMIT });
        await resetDb();
        await seedActiveUser(harness.app, {
            email: EMAIL,
            password: PASSWORD,
            role: 'viewer'
        });

        // Instance one: two of the three allowed attempts.
        await attempt(harness).expect(401);
        await attempt(harness).expect(401);
        await closeTestApp(harness);
        harness = undefined;

        // Instance two, fresh process state: one attempt left, then refused.
        // An in-memory store would allow three more here.
        harness = await createTestApp({ rateLimit: LIMIT });
        await attempt(harness).expect(401);
        await attempt(harness).expect(429);
    });
});
