import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countLiveUserSessions,
    countUserSessions,
    getUserByEmail,
    resetDb,
    seedActiveUser,
    seedUser,
    seedUserWithPermissions,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'status-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `POST /api/users/:id/disable` and `/enable` — flip account status. */
describe('POST /api/users/:id/(disable|enable)', () => {
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

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('disables an active member and revokes their sessions', async () => {
        // A logged-in member with a live session, then disabled by the admin.
        const member = await seedActiveUser(harness.app, {
            email: 'member@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        const memberAgent = await login('member@example.com'); // opens a session
        expect(await countUserSessions(member.id)).toBe(1);
        await memberAgent.get('/api/auth/me').expect(200);

        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post(`/api/users/${member.id}/disable`)
            .expect(201);
        expect(res.body.status).toBe('disabled');

        const row = await getUserByEmail('member@example.com');
        expect(row?.status).toBe('disabled');

        // The session the member was already holding dies with the disable —
        // they are signed out where they sit, not at next expiry. (Revocation
        // is soft, so the row survives for audit; only its use is refused.)
        await memberAgent.get('/api/auth/me').expect(401);

        // And they cannot open a new one.
        await request(harness.server)
            .post('/api/auth/login')
            .send({ email: 'member@example.com', password: PASSWORD })
            .expect(401);
    });

    it('lets a reactivated member sign in again, on a fresh session', async () => {
        const member = await seedActiveUser(harness.app, {
            email: 'member@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        const memberAgent = await login('member@example.com');

        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${member.id}/disable`).expect(201);
        await agent.post(`/api/users/${member.id}/enable`).expect(201);

        // Reactivating restores sign-in, but never resurrects the revoked
        // cookie — the member logs back in.
        await memberAgent.get('/api/auth/me').expect(401);
        const revived = await login('member@example.com');
        await revived.get('/api/auth/me').expect(200);
    });

    it('revokes every session the member holds, not just the newest', async () => {
        const member = await seedActiveUser(harness.app, {
            email: 'member@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        // Two devices signed in as the same person.
        await login('member@example.com');
        await login('member@example.com');
        expect(await countUserSessions(member.id)).toBe(2);

        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${member.id}/disable`).expect(201);

        // Revocation is **soft**: both rows are still there, stamped
        // `revoked_at`, because the audit trail wants them. So counting rows
        // would report two sessions and prove nothing — the live count is the
        // one that says the lockout reached every device rather than the last
        // one to sign in.
        expect(await countLiveUserSessions(member.id)).toBe(0);
        expect(await countUserSessions(member.id)).toBe(2);
    });

    it('refuses to let a member disable themselves with 409 [users:I-02]', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post(`/api/users/${admin.id}/disable`)
            .expect(409);

        // The self guard runs before the unit of work opens, so it wins over
        // the last-admin one even though this admin is also the last. The code
        // is what a client renders the difference from — "you cannot disable
        // your own account" is actionable, "conflict" is not.
        expect(res.body.code).toBe('SELF_ACTION');
        expect(res.body.statusCode).toBe(409);
        expect(res.body.error).toBe('Conflict');

        const row = await getUserByEmail(ADMIN_EMAIL);
        expect(row?.status).toBe('active');
    });

    it('refuses to disable the only active admin with 409 [users:I-01] [users:I-16]', async () => {
        // Needs a non-admin holding users:update: an admin aiming at the sole
        // remaining admin is aiming at themselves, and SELF_ACTION fires
        // first — so from an admin's session this 409 is unreachable and the
        // guard behind it never runs.
        await seedUserWithPermissions(harness.app, {
            email: 'ops@example.com',
            password: PASSWORD,
            roleKey: 'set-status-ops',
            permissions: ['users:read', 'users:update']
        });
        const adminAgent = await login(ADMIN_EMAIL); // a live session at risk
        const agent = await login('ops@example.com');

        const res = await agent
            .post(`/api/users/${admin.id}/disable`)
            .expect(409);
        expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');

        // The guard throws inside the unit of work, so the status change and
        // the session revocation roll back together — a partial failure here
        // would sign the last admin out of an account they still hold.
        expect((await getUserByEmail(ADMIN_EMAIL))?.status).toBe('active');
        expect(await countLiveUserSessions(admin.id)).toBe(1);
        await adminAgent.get('/api/auth/me').expect(200);
    });

    it('rejects disabling an already-disabled member with 409 [users:I-09]', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'disabled'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${member.id}/disable`).expect(409);
    });

    it('re-enables a disabled member', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'disabled'
        });
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post(`/api/users/${member.id}/enable`)
            .expect(201);
        expect(res.body.status).toBe('active');

        const row = await getUserByEmail('member@example.com');
        expect(row?.status).toBe('active');
    });

    it('rejects enabling an already-active member with 409 [users:I-09]', async () => {
        const member = await seedActiveUser(harness.app, {
            email: 'member@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${member.id}/enable`).expect(409);
    });

    it('rejects enabling a pending member with 409 [users:I-09]', async () => {
        // Only a `disabled` account may be enabled. A pending invitee becomes
        // active by accepting their invite — flipping the row here would leave
        // an "active" account with no credential on it, which nothing
        // downstream expects to exist.
        const member = await seedUser(harness.app, {
            email: 'pending@example.com',
            role: 'viewer',
            status: 'pending'
        });
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post(`/api/users/${member.id}/enable`)
            .expect(409);

        expect(res.body.code).toBe('INVALID_MEMBER_STATE');
        expect((await getUserByEmail('pending@example.com'))?.status).toBe(
            'pending'
        );
    });

    it('returns 404 disabling an unknown id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/00000000-0000-0000-0000-000000000000/disable')
            .expect(404);
    });

    it('returns 404 enabling an unknown id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/00000000-0000-0000-0000-000000000000/enable')
            .expect(404);
    });

    it('returns 400 for a non-uuid id on both routes', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent.post('/api/users/not-a-uuid/disable').expect(400);
        await agent.post('/api/users/not-a-uuid/enable').expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'active'
        });
        await request(harness.server)
            .post(`/api/users/${member.id}/disable`)
            .expect(401);
    });

    it('forbids a contributor (lacks users:update) with 403', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedActiveUser(harness.app, {
            email: 'contributor@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        const agent = await login('contributor@example.com');
        await agent.post(`/api/users/${member.id}/disable`).expect(403);
    });

    it('forbids a viewer (lacks users:update) with 403', async () => {
        // `users:read` is granted to every role, so a viewer can see the
        // members grid — the gate that matters is the one on the action, and
        // it has to hold for the lowest-privilege role too.
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedActiveUser(harness.app, {
            email: 'viewer@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login('viewer@example.com');
        await agent.post(`/api/users/${member.id}/disable`).expect(403);

        expect((await getUserByEmail('member@example.com'))?.status).toBe(
            'active'
        );
    });
});
