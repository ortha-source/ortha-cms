import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';
import {
    getResetTokenHashes,
    resetDb,
    seedActiveUser,
    seedUser,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'origin-admin@example.com';
const PASSWORD = 'SecurePass123!';
const EVIL_ORIGIN = 'https://evil.example';

/**
 * `OriginGuard` (CSRF) across every state-changing route in `users-server`.
 *
 * This suite exists because the package shipped without the guard on **any** of
 * them — the only plugin in the repo that omitted it — while exposing the most
 * privileged mutations in the product: promote to admin, disable an account,
 * delete a pending account. The class-level decorator stack *looked* complete,
 * which is exactly why nothing caught it. `ARCHITECTURE.md §5.3` states the
 * invariant: state-changing routes additionally pass an `OriginGuard`.
 *
 * Each route is asserted three ways — hostile Origin rejected, configured app
 * origin allowed, and no Origin allowed (a non-browser client) — so a future
 * refactor can't quietly drop the guard or over-tighten it into breaking curl.
 */
describe('OriginGuard — users-server state-changing routes', () => {
    let harness: TestApp;
    let admin: SeededUser;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** A second admin, so last-admin guards never mask an Origin result. */
    async function seedSecondAdmin() {
        return seedActiveUser(harness.app, {
            email: 'origin-admin-b@example.com',
            password: PASSWORD,
            role: 'admin'
        });
    }

    async function seedPending() {
        return seedUser(harness.app, {
            email: `pending-${Date.now()}@example.com`,
            role: 'viewer',
            status: 'pending'
        });
    }

    describe('PATCH /api/users/:id', () => {
        it('rejects a disallowed Origin with 403', async () => {
            const target = await seedSecondAdmin();
            const agent = await login();
            await agent
                .patch(`/api/users/${target.id}`)
                .set('Origin', EVIL_ORIGIN)
                .send({ name: 'CSRF Rename' })
                .expect(403);
        });

        it('allows the configured app origin', async () => {
            const target = await seedSecondAdmin();
            const agent = await login();
            await agent
                .patch(`/api/users/${target.id}`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ name: 'Legit Rename' })
                .expect(200);
        });

        it('allows a request with no Origin (non-browser client)', async () => {
            const target = await seedSecondAdmin();
            const agent = await login();
            await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: 'Legit Rename' })
                .expect(200);
        });

        it('does not escalate a role from a hostile Origin', async () => {
            // The account-takeover payload: without the guard this returned 200
            // and the role actually changed.
            const target = await seedUser(harness.app, {
                email: 'victim@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login();
            await agent
                .patch(`/api/users/${target.id}`)
                .set('Origin', EVIL_ORIGIN)
                .send({ role: 'admin' })
                .expect(403);

            const after = await agent
                .get(`/api/users/${target.id}`)
                .expect(200);
            expect(after.body.role.key).toBe('viewer');
        });
    });

    describe('POST /api/users/invites', () => {
        it('rejects a disallowed Origin with 403', async () => {
            const agent = await login();
            await agent
                .post('/api/users/invites')
                .set('Origin', EVIL_ORIGIN)
                .send({ email: 'csrf@example.com', role: 'viewer' })
                .expect(403);
        });

        it('allows the configured app origin', async () => {
            const agent = await login();
            await agent
                .post('/api/users/invites')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: 'legit@example.com', role: 'viewer' })
                .expect(201);
        });

        it('allows a request with no Origin (non-browser client)', async () => {
            const agent = await login();
            await agent
                .post('/api/users/invites')
                .send({ email: 'legit2@example.com', role: 'viewer' })
                .expect(201);
        });
    });

    describe('POST /api/users/:id/disable', () => {
        it('rejects a disallowed Origin with 403, leaving the account active', async () => {
            const target = await seedUser(harness.app, {
                email: 'disable-victim@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login();
            await agent
                .post(`/api/users/${target.id}/disable`)
                .set('Origin', EVIL_ORIGIN)
                .expect(403);

            const after = await agent
                .get(`/api/users/${target.id}`)
                .expect(200);
            expect(after.body.status).toBe('active');
        });

        it('allows the configured app origin', async () => {
            const target = await seedUser(harness.app, {
                email: 'disable-ok@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login();
            await agent
                .post(`/api/users/${target.id}/disable`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .expect(201);
        });
    });

    describe('POST /api/users/:id/enable', () => {
        it('rejects a disallowed Origin with 403', async () => {
            const target = await seedUser(harness.app, {
                email: 'enable-victim@example.com',
                role: 'viewer',
                status: 'disabled'
            });
            const agent = await login();
            await agent
                .post(`/api/users/${target.id}/enable`)
                .set('Origin', EVIL_ORIGIN)
                .expect(403);
        });
    });

    describe('POST /api/users/:id/invites/resend', () => {
        it('rejects a disallowed Origin with 403', async () => {
            const pending = await seedPending();
            const agent = await login();
            await agent
                .post(`/api/users/${pending.id}/invites/resend`)
                .set('Origin', EVIL_ORIGIN)
                .expect(403);
        });

        it('allows the configured app origin', async () => {
            const pending = await seedPending();
            const agent = await login();
            await agent
                .post(`/api/users/${pending.id}/invites/resend`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .expect(201);
        });
    });

    describe('DELETE /api/users/:id/invites', () => {
        it('rejects a disallowed Origin with 403, leaving the row in place', async () => {
            const pending = await seedPending();
            const agent = await login();
            await agent
                .delete(`/api/users/${pending.id}/invites`)
                .set('Origin', EVIL_ORIGIN)
                .expect(403);

            await agent.get(`/api/users/${pending.id}`).expect(200);
        });

        it('allows the configured app origin', async () => {
            const pending = await seedPending();
            const agent = await login();
            await agent
                .delete(`/api/users/${pending.id}/invites`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .expect(204);
        });
    });

    describe('POST /api/users/:id/password-reset', () => {
        it('rejects a disallowed Origin with 403, minting no link', async () => {
            const target = await seedUser(harness.app, {
                email: 'reset-victim@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login();
            await agent
                .post(`/api/users/${target.id}/password-reset`)
                .set('Origin', EVIL_ORIGIN)
                .expect(403);

            expect(await getResetTokenHashes(target.id)).toHaveLength(0);
        });

        it('allows the configured app origin', async () => {
            const target = await seedUser(harness.app, {
                email: 'reset-ok@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login();
            await agent
                .post(`/api/users/${target.id}/password-reset`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .expect(201);
        });
    });

    describe('reads are unaffected', () => {
        it('allows GET /api/users from any Origin', async () => {
            const agent = await login();
            await agent
                .get('/api/users')
                .set('Origin', EVIL_ORIGIN)
                .expect(200);
        });

        it('allows GET /api/users/:id from any Origin', async () => {
            const agent = await login();
            await agent
                .get(`/api/users/${admin.id}`)
                .set('Origin', EVIL_ORIGIN)
                .expect(200);
        });
    });
});
