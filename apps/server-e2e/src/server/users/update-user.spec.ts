import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    getUserByEmail,
    resetDb,
    seedActiveUser,
    seedUser,
    seedUserWithPermissions,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'update-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `PATCH /api/users/:id` — edit a member's name and/or role. */
describe('PATCH /api/users/:id', () => {
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

    it('rejects an unauthenticated request with 401', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        await request(harness.server)
            .patch(`/api/users/${target.id}`)
            .send({ role: 'contributor' })
            .expect(401);
    });

    it('changes a member’s role and persists it', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);

        const res = await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'contributor' })
            .expect(200);
        expect(res.body.role.key).toBe('contributor');

        const row = await getUserByEmail('target@example.com');
        expect(row?.roleKey).toBe('contributor');
    });

    it('updates the display name', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .patch(`/api/users/${target.id}`)
            .send({ name: 'Renamed' })
            .expect(200);
        expect(res.body.name).toBe('Renamed');
    });

    it('refuses to demote the last remaining admin with 409', async () => {
        // The seeded admin is the only active admin — demoting them is blocked.
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${admin.id}`)
            .send({ role: 'viewer' })
            .expect(409);

        const row = await getUserByEmail(ADMIN_EMAIL);
        expect(row?.roleKey).toBe('admin');
    });

    it('allows demoting an admin when another active admin remains', async () => {
        const second = await seedUser(harness.app, {
            email: 'second-admin@example.com',
            role: 'admin',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${second.id}`)
            .send({ role: 'viewer' })
            .expect(200);
    });

    it('rejects an unknown role with 400', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'root' })
            .expect(400);
    });

    it('rejects an unknown extra field with 400', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${target.id}`)
            .send({ status: 'disabled' })
            .expect(400);
    });

    it('returns 404 for an unknown id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch('/api/users/00000000-0000-0000-0000-000000000000')
            .send({ role: 'viewer' })
            .expect(404);
    });

    it('returns 400 for a non-uuid id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch('/api/users/not-a-uuid')
            .send({ role: 'viewer' })
            .expect(400);
    });

    it('forbids a viewer (lacks users:update) with 403', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedActiveUser(harness.app, {
            email: 'viewer@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login('viewer@example.com');
        await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'contributor' })
            .expect(403);
    });

    describe('display name is trimmed, and may not be blank', () => {
        // `@IsNotEmpty` rejects '' but accepts '   ', and this row is the only
        // source of that person's human identifier — a blank one leaves the
        // members table, the avatar initials and the audit log's actor column
        // with nothing to render (508 §504.2).
        it('rejects a whitespace-only name with 400', async () => {
            const target = await seedUser(harness.app, {
                email: 'blank-name@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login(ADMIN_EMAIL);
            await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: '   ' })
                .expect(400);
        });

        it('trims surrounding whitespace from a real name', async () => {
            const target = await seedUser(harness.app, {
                email: 'padded-name@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: '  Grace Hopper  ' })
                .expect(200);
            expect(res.body.name).toBe('Grace Hopper');
        });
    });

    describe('conflict bodies carry a stable machine code', () => {
        it('tags a self role change as SELF_ACTION', async () => {
            await seedActiveUser(harness.app, {
                email: 'other-admin@example.com',
                password: PASSWORD,
                role: 'admin'
            });
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .patch(`/api/users/${admin.id}`)
                .send({ role: 'viewer' })
                .expect(409);

            expect(res.body.code).toBe('SELF_ACTION');
            // Additive: the fields clients already read are untouched.
            expect(res.body.statusCode).toBe(409);
            expect(res.body.error).toBe('Conflict');
        });

        it('tags demoting the last admin as LAST_ADMIN_PROTECTED', async () => {
            // Needs a non-admin holding users:update — an admin looking at the
            // sole admin is looking at themselves, so SELF_ACTION fires first.
            await seedUserWithPermissions(harness.app, {
                email: 'ops@example.com',
                password: PASSWORD,
                roleKey: 'update-user-ops',
                permissions: ['users:read', 'users:update']
            });
            const agent = await login('ops@example.com');
            const res = await agent
                .patch(`/api/users/${admin.id}`)
                .send({ role: 'viewer' })
                .expect(409);

            expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
        });
    });
});
