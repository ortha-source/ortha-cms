import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedUser,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'get-user-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `GET /api/users/:id` — one member's full detail view. */
describe('GET /api/users/:id', () => {
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
        await request(harness.server).get(`/api/users/${admin.id}`).expect(401);
    });

    it('returns the member with role and workspaces', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            name: 'Target Member',
            role: 'contributor',
            status: 'active'
        });
        const workspace = await seedWorkspace({ name: 'Acme', slug: 'acme' });
        await seedMembership(target.id, workspace.id);

        const agent = await login(ADMIN_EMAIL);
        const res = await agent.get(`/api/users/${target.id}`).expect(200);

        expect(res.body).toMatchObject({
            id: target.id,
            email: 'target@example.com',
            name: 'Target Member',
            status: 'active'
        });
        expect(res.body.role.key).toBe('contributor');
        expect(res.body.workspaces).toEqual([
            expect.objectContaining({ id: workspace.id, name: 'Acme' })
        ]);
    });

    it('carries description and color on each workspace row', async () => {
        // `WorkspaceMembershipCard` renders `workspace.description` behind a
        // truthiness check, and `memberMapper` reads `dto.description` straight
        // off the wire. Neither end was pinned: the field was absent from the
        // admin-e2e seed, so the description block never rendered in a browser
        // suite, and the assertion above is an `objectContaining` that would
        // pass with the field gone. A server that dropped it would show up as
        // nothing at all.
        const target = await seedUser(harness.app, {
            email: 'described@example.com',
            name: 'Described Member',
            role: 'contributor',
            status: 'active'
        });
        const workspace = await seedWorkspace({
            name: 'Described',
            slug: 'described',
            description: 'The workspace the card writes a line about.',
            color: 'violet'
        });
        await seedMembership(target.id, workspace.id);

        const agent = await login(ADMIN_EMAIL);
        const res = await agent.get(`/api/users/${target.id}`).expect(200);

        expect(res.body.workspaces).toEqual([
            {
                id: workspace.id,
                name: 'Described',
                description: 'The workspace the card writes a line about.',
                color: 'violet'
            }
        ]);
    });

    it('sends description as null when the workspace has none', async () => {
        // The card's third state. `description: string | null` on both sides,
        // so "absent" and "explicitly empty" have to stay distinguishable — a
        // mapper that dropped the key instead of passing `null` would read the
        // same to the truthiness check but breaks the declared type.
        const target = await seedUser(harness.app, {
            email: 'undescribed@example.com',
            name: 'Undescribed Member',
            role: 'contributor',
            status: 'active'
        });
        const workspace = await seedWorkspace({
            name: 'Plain',
            slug: 'plain'
        });
        await seedMembership(target.id, workspace.id);

        const agent = await login(ADMIN_EMAIL);
        const res = await agent.get(`/api/users/${target.id}`).expect(200);

        expect(res.body.workspaces[0]).toHaveProperty('description', null);
    });

    it('flags the sole active admin with isLastAdmin', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent.get(`/api/users/${admin.id}`).expect(200);
        expect(res.body.isLastAdmin).toBe(true);
    });

    it('returns 404 for an unknown id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .get('/api/users/00000000-0000-0000-0000-000000000000')
            .expect(404);
    });

    it('returns 400 for a non-uuid id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent.get('/api/users/not-a-uuid').expect(400);
    });

    it('allows a viewer (holds users:read) to read a member', async () => {
        await seedActiveUser(harness.app, {
            email: 'viewer@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login('viewer@example.com');
        await agent.get(`/api/users/${admin.id}`).expect(200);
    });
});
