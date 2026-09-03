import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countActivityRows,
    getActivityRows,
    resetDb,
    seedActiveUser,
    seedUser,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'activity-admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * `GET /api/activity` plus the in-band recording that feeds it: the read API,
 * its `activity:read` gate, filtering/pagination/sort, and the transactional
 * guarantee that a rejected mutation leaves no audit row.
 */
describe('Activity log (GET /api/activity + recording)', () => {
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

    describe('recording (in-band, transactional)', () => {
        it('records user.signed_in on login and exposes it via the read API [activity:I-04]', async () => {
            const agent = await login(ADMIN_EMAIL);

            const res = await agent
                .get('/api/activity?kind=user.signed_in')
                .expect(200);

            expect(res.body.total).toBe(1);
            expect(res.body.items).toHaveLength(1);
            const event = res.body.items[0];
            expect(event).toMatchObject({
                kind: 'user.signed_in',
                subjectType: 'user',
                subjectId: admin.id,
                actorId: admin.id,
                actorEmail: ADMIN_EMAIL
            });
            // covers: activity:I-20
            // `created_at` is internal and never reaches the wire.
            expect(event).not.toHaveProperty('createdAt');
            expect(event).not.toHaveProperty('created_at');
        });

        it('records user.suspended when an admin disables a member', async () => {
            const member = await seedActiveUser(harness.app, {
                email: 'member@example.com',
                password: PASSWORD,
                role: 'contributor'
            });
            const agent = await login(ADMIN_EMAIL);

            await agent.post(`/api/users/${member.id}/disable`).expect(201);

            const res = await agent
                .get('/api/activity?kind=user.suspended')
                .expect(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0]).toMatchObject({
                kind: 'user.suspended',
                subjectType: 'user',
                subjectId: member.id,
                actorId: admin.id,
                actorEmail: ADMIN_EMAIL
            });
        });

        it('records user.role_changed with the from/to roles in meta', async () => {
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login(ADMIN_EMAIL);

            await agent
                .patch(`/api/users/${member.id}`)
                .send({ role: 'contributor' })
                .expect(200);

            const res = await agent
                .get('/api/activity?kind=user.role_changed')
                .expect(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].meta).toEqual({
                from: 'viewer',
                to: 'contributor'
            });
        });

        it('records user.invited with the email in meta', async () => {
            const agent = await login(ADMIN_EMAIL);

            const invited = await agent
                .post('/api/users/invites')
                .send({ email: 'invitee@example.com', role: 'contributor' })
                .expect(201);

            const res = await agent
                .get('/api/activity?kind=user.invited')
                .expect(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0]).toMatchObject({
                subjectId: invited.body.id,
                actorEmail: ADMIN_EMAIL,
                meta: { email: 'invitee@example.com' }
            });
        });
    });

    describe('transactional guarantee', () => {
        it('writes no audit row when the mutation is rejected and rolled back', async () => {
            // An already-disabled member: disable() throws inside the
            // transaction, so any audit write rolls back with it.
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'disabled'
            });
            const agent = await login(ADMIN_EMAIL); // one signed_in event

            await agent.post(`/api/users/${member.id}/disable`).expect(409);

            // Only the admin's sign-in remains — no suspended/reactivated row.
            const rows = await getActivityRows();
            expect(rows.map((row) => row.kind)).toEqual(['user.signed_in']);
        });

        it('records nothing for the member when re-enable is rejected', async () => {
            const member = await seedActiveUser(harness.app, {
                email: 'member@example.com',
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = await login(ADMIN_EMAIL);

            // Active member can't be re-enabled → 409, rolled back.
            await agent.post(`/api/users/${member.id}/enable`).expect(409);

            const rows = await getActivityRows();
            expect(rows.some((row) => row.subjectId === member.id)).toBe(false);
        });
    });

    describe('filtering, pagination, and sort', () => {
        async function seedEvents() {
            const member = await seedActiveUser(harness.app, {
                email: 'member@example.com',
                password: PASSWORD,
                role: 'contributor'
            });
            const agent = await login(ADMIN_EMAIL); // user.signed_in (admin)
            await agent.post(`/api/users/${member.id}/disable`).expect(201); // suspended
            await agent.post(`/api/users/${member.id}/enable`).expect(201); // reactivated
            return { agent, member };
        }

        it('filters by a comma-separated kind list (IN)', async () => {
            const { agent } = await seedEvents();

            const res = await agent
                .get('/api/activity?kind=user.suspended,user.reactivated')
                .expect(200);

            const kinds = res.body.items.map(
                (item: { kind: string }) => item.kind
            );
            expect(kinds.sort()).toEqual([
                'user.reactivated',
                'user.suspended'
            ]);
        });

        it('filters by actor email (case-insensitive substring) [activity:I-19]', async () => {
            const { agent } = await seedEvents();

            const res = await agent
                .get('/api/activity?actorEmail=ACTIVITY-ADMIN')
                .expect(200);

            expect(res.body.total).toBe(3); // signed_in + suspended + reactivated
            for (const item of res.body.items) {
                expect(item.actorEmail).toBe(ADMIN_EMAIL);
            }
        });

        it('paginates with page/pageSize and echoes the envelope [activity:I-15]', async () => {
            const { agent } = await seedEvents();

            const res = await agent
                .get('/api/activity?page=1&pageSize=2')
                .expect(200);

            expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
            expect(res.body.items).toHaveLength(2);
        });

        it('refuses a pageSize above the 100-row maximum, and serves 100 itself [activity:I-18]', async () => {
            const { agent } = await seedEvents();

            // The cap is `@Max(MAX_PAGE_SIZE)` on `ListActivityQueryDto`, so the
            // global `ValidationPipe` answers before the controller runs. A
            // handler that passed `pageSize` straight into the query would
            // answer 200 to all three of these, and on a three-row log a
            // `LIMIT 101` is indistinguishable from a `LIMIT 100` — which is why
            // the refusal, not the row count, is what this asserts.
            await agent.get('/api/activity?pageSize=101').expect(400);
            await agent.get('/api/activity?pageSize=1000').expect(400);

            // The boundary itself is served, not refused: an off-by-one that
            // rejected 100 too would take the admin's own largest rows-per-page
            // option down with it.
            const ok = await agent
                .get('/api/activity?pageSize=100')
                .expect(200);
            expect(ok.body.pageSize).toBe(100);
        });

        it('sorts by time, newest first by default and oldest first on asc', async () => {
            const { agent } = await seedEvents();

            const desc = await agent.get('/api/activity').expect(200);
            const asc = await agent.get('/api/activity?order=asc').expect(200);

            const descKinds = desc.body.items.map(
                (item: { kind: string }) => item.kind
            );
            const ascKinds = asc.body.items.map(
                (item: { kind: string }) => item.kind
            );
            expect(ascKinds).toEqual([...descKinds].reverse());
        });

        it('returns an empty page for a future `from` bound', async () => {
            await seedEvents();
            const agent = await login(ADMIN_EMAIL);

            const res = await agent
                .get('/api/activity?from=2999-01-01')
                .expect(200);
            expect(res.body.total).toBe(0);
            expect(res.body.items).toEqual([]);
        });
    });

    describe('authorization (activity:read)', () => {
        it('allows an admin (200)', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent.get('/api/activity').expect(200);
        });

        it('forbids a contributor with 403 [activity:I-14]', async () => {
            await seedActiveUser(harness.app, {
                email: 'contributor@example.com',
                password: PASSWORD,
                role: 'contributor'
            });
            const agent = await login('contributor@example.com');
            await agent.get('/api/activity').expect(403);
        });

        it('forbids a viewer with 403', async () => {
            await seedActiveUser(harness.app, {
                email: 'viewer@example.com',
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = await login('viewer@example.com');
            await agent.get('/api/activity').expect(403);
        });

        it('rejects an unauthenticated request with 401 [activity:I-14]', async () => {
            await request(harness.server).get('/api/activity').expect(401);
        });
    });

    describe('logout', () => {
        it('records user.signed_out for the session owner', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent.post('/api/auth/logout').expect(201);

            const rows = await getActivityRows();
            const signedOut = rows.find(
                (row) => row.kind === 'user.signed_out'
            );
            expect(signedOut).toMatchObject({
                subjectId: admin.id,
                actorId: admin.id,
                actorEmail: ADMIN_EMAIL
            });
        });

        it('records nothing extra for a logout with no live session', async () => {
            // No login → no signed_in; logout with no cookie is a no-op.
            await request(harness.server).post('/api/auth/logout').expect(201);
            expect(await countActivityRows()).toBe(0);
        });
    });
});
