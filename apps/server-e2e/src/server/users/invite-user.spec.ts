import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    getInviteTokenHashes,
    getUserByEmail,
    resetDb,
    seedActiveUser
} from '../../support/seed';

const ADMIN_EMAIL = 'invite-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `POST /api/users/invites` — invite a person by email. */
describe('POST /api/users/invites', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(harness.app, {
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
        await request(harness.server)
            .post('/api/users/invites')
            .send({ email: 'new@example.com', role: 'viewer' })
            .expect(401);
    });

    it('creates a pending member, assigns the role, and issues an invite token', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/users/invites')
            .send({
                email: 'New@Example.com',
                role: 'contributor',
                name: 'Newbie'
            })
            .expect(201);

        expect(res.body.status).toBe('pending');
        expect(res.body.role.key).toBe('contributor');
        expect(res.body.name).toBe('Newbie');

        // Email is persisted lower-cased; the row is pending with a token.
        const row = await getUserByEmail('new@example.com');
        expect(row).not.toBeNull();
        expect(row?.status).toBe('pending');
        expect(row?.roleKey).toBe('contributor');
        expect(row?.passwordHash).toBeNull();

        const tokenHashes = await getInviteTokenHashes(row!.id);
        expect(tokenHashes).toHaveLength(1);
    });

    it('rejects a duplicate email with 409', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'dupe@example.com', role: 'viewer' })
            .expect(201);
        await agent
            .post('/api/users/invites')
            .send({ email: 'dupe@example.com', role: 'viewer' })
            .expect(409);
    });

    it('treats an existing email case-insensitively (409)', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: ADMIN_EMAIL.toUpperCase(), role: 'viewer' })
            .expect(409);
    });

    it('rejects a malformed email with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'not-an-email', role: 'viewer' })
            .expect(400);
    });

    it('rejects an unknown role with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'superuser' })
            .expect(400);
    });

    it('rejects an unknown extra field with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'viewer', isAdmin: true })
            .expect(400);
    });

    it('forbids a contributor (lacks users:create) with 403', async () => {
        await seedActiveUser(harness.app, {
            email: 'contributor@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        const agent = await login('contributor@example.com');
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'viewer' })
            .expect(403);
    });
});
