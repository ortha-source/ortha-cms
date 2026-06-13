import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser, seedUser } from '../../support/seed';

const ADMIN_EMAIL = 'list-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `GET /api/users` — the searchable, paginated members list. */
describe('GET /api/users', () => {
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
            role: 'admin',
            name: 'Ada Admin'
        });
    });

    /** A logged-in supertest agent for the seeded admin. */
    async function adminAgent() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('rejects an unauthenticated request with 401', async () => {
        await request(harness.server).get('/api/users').expect(401);
    });

    it('returns the paginated envelope with the expected shape', async () => {
        const agent = await adminAgent();
        const res = await agent.get('/api/users').expect(200);

        expect(Object.keys(res.body).sort()).toEqual([
            'items',
            'page',
            'pageSize',
            'total'
        ]);
        expect(res.body.total).toBe(1);
        expect(res.body.page).toBe(1);

        const [member] = res.body.items;
        expect(Object.keys(member).sort()).toEqual([
            'createdAt',
            'email',
            'id',
            'isLastAdmin',
            'name',
            'role',
            'status',
            'workspaces'
        ]);
        expect(member.email).toBe(ADMIN_EMAIL);
        expect(member.role).toEqual({
            id: expect.any(String),
            key: 'admin',
            name: 'Administrator'
        });
        // The sole active admin is flagged so the UI can lock its controls.
        expect(member.isLastAdmin).toBe(true);
    });

    it('never leaks the password hash', async () => {
        const agent = await adminAgent();
        const res = await agent.get('/api/users').expect(200);
        const raw = JSON.stringify(res.body);
        expect(raw).not.toContain('passwordHash');
        expect(raw).not.toContain('password_hash');
    });

    it('filters by a name or email substring, case-insensitively', async () => {
        await seedUser(harness.app, {
            email: 'grace@example.com',
            role: 'viewer',
            status: 'active',
            name: 'Grace Hopper'
        });

        const agent = await adminAgent();

        const byName = await agent.get('/api/users?search=hopper').expect(200);
        expect(byName.body.total).toBe(1);
        expect(byName.body.items[0].email).toBe('grace@example.com');

        const byEmail = await agent
            .get('/api/users?search=LIST-ADMIN')
            .expect(200);
        expect(byEmail.body.total).toBe(1);
        expect(byEmail.body.items[0].email).toBe(ADMIN_EMAIL);
    });

    it('paginates with page and pageSize', async () => {
        // Seed 14 extra members (15 total with the admin).
        for (let index = 0; index < 14; index++) {
            await seedUser(harness.app, {
                email: `member-${index}@example.com`,
                role: 'viewer',
                status: 'active',
                name: `Member ${String(index).padStart(2, '0')}`
            });
        }

        const agent = await adminAgent();

        const first = await agent
            .get('/api/users?page=1&pageSize=10')
            .expect(200);
        expect(first.body.total).toBe(15);
        expect(first.body.items).toHaveLength(10);
        expect(first.body.pageSize).toBe(10);

        const second = await agent
            .get('/api/users?page=2&pageSize=10')
            .expect(200);
        expect(second.body.items).toHaveLength(5);

        // Pages don't overlap.
        const firstIds = new Set(
            first.body.items.map((m: { id: string }) => m.id)
        );
        for (const member of second.body.items) {
            expect(firstIds.has(member.id)).toBe(false);
        }
    });

    it('returns every status when unfiltered (the members grid contract)', async () => {
        await seedUser(harness.app, {
            email: 'pending@example.com',
            role: 'viewer',
            status: 'pending'
        });
        await seedUser(harness.app, {
            email: 'disabled@example.com',
            role: 'viewer',
            status: 'disabled'
        });

        const agent = await adminAgent();
        const res = await agent.get('/api/users').expect(200);
        const emails = res.body.items.map((m: { email: string }) => m.email);
        expect(emails).toEqual(
            expect.arrayContaining([
                'pending@example.com',
                'disabled@example.com'
            ])
        );
    });

    it('scopes to active accounts when status=active (the typeahead contract)', async () => {
        await seedUser(harness.app, {
            email: 'pending@example.com',
            role: 'viewer',
            status: 'pending'
        });
        await seedUser(harness.app, {
            email: 'disabled@example.com',
            role: 'viewer',
            status: 'disabled'
        });

        const agent = await adminAgent();
        const res = await agent.get('/api/users?status=active').expect(200);
        const emails = res.body.items.map((m: { email: string }) => m.email);
        expect(emails).toContain(ADMIN_EMAIL);
        expect(emails).not.toContain('pending@example.com');
        expect(emails).not.toContain('disabled@example.com');
        // total reflects the filter, not the whole table.
        expect(res.body.total).toBe(1);
    });

    it('rejects an unknown status with 400', async () => {
        const agent = await adminAgent();
        await agent.get('/api/users?status=bogus').expect(400);
    });

    it('rejects an unknown query field with 400', async () => {
        const agent = await adminAgent();
        await agent.get('/api/users?bogus=1').expect(400);
    });

    it('rejects a non-numeric page with 400', async () => {
        const agent = await adminAgent();
        await agent.get('/api/users?page=abc').expect(400);
    });

    it('accepts the maximum page size (100)', async () => {
        const agent = await adminAgent();
        const res = await agent.get('/api/users?pageSize=100').expect(200);
        expect(res.body.pageSize).toBe(100);
    });

    it('rejects a page size over the maximum with 400', async () => {
        const agent = await adminAgent();
        await agent.get('/api/users?pageSize=101').expect(400);
    });

    it('allows a viewer to read (users:read is granted to every role)', async () => {
        await seedActiveUser(harness.app, {
            email: 'viewer@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: 'viewer@example.com', password: PASSWORD })
            .expect(201);
        await agent.get('/api/users').expect(200);
    });
});
