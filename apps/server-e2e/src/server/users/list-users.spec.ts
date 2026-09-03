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

    it('returns the paginated envelope with the expected shape [users:I-05]', async () => {
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

    it('treats a literal % in the search as a character, not a wildcard', async () => {
        // The needle is interpolated into an ILIKE pattern, so its own LIKE
        // metacharacters have to be escaped first. Unescaped, `pct%user`
        // reaches SQL as `%pct%user%` and matches both of these — a search box
        // that silently widens the query it was given, and (with `_`) one an
        // address can be probed through.
        await seedUser(harness.app, {
            email: 'pct%user@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedUser(harness.app, {
            email: 'pctuser@example.com',
            role: 'viewer',
            status: 'active'
        });

        const agent = await adminAgent();
        const res = await agent
            .get('/api/users')
            .query({ search: 'pct%user' })
            .expect(200);

        expect(res.body.total).toBe(1);
        expect(res.body.items[0].email).toBe('pct%user@example.com');
    });

    it('neither repeats nor drops a row when names collide across pages', async () => {
        // The ordering is `name, id`. With distinct names the tiebreak never
        // has to decide anything, so the pagination test above would pass
        // without it — a page boundary *inside* a run of equal names is the
        // only place its absence shows, and it shows as one row served twice
        // and another never served at all.
        const ids: string[] = [];
        for (let index = 0; index < 6; index += 1) {
            const twin = await seedUser(harness.app, {
                email: `twin-${index}@example.com`,
                role: 'viewer',
                status: 'active',
                name: 'Twin'
            });
            ids.push(twin.id);
        }

        const agent = await adminAgent();
        const seen: string[] = [];
        for (const page of [1, 2, 3]) {
            const res = await agent
                .get('/api/users')
                .query({ page, pageSize: 3 })
                .expect(200);
            seen.push(...res.body.items.map((m: { id: string }) => m.id));
        }

        expect(seen).toHaveLength(7); // the admin plus six twins
        expect(new Set(seen).size).toBe(7);
        for (const id of ids) {
            expect(seen).toContain(id);
        }
    });

    it('lists a member who has no name, and sorts them last', async () => {
        // `name` is nullable until someone sets one, so an invited member who
        // never filled it in is an ordinary row — not one the grid may drop,
        // and not one that may take the ordering down with it.
        await seedUser(harness.app, {
            email: 'nameless@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedUser(harness.app, {
            email: 'zoe@example.com',
            role: 'viewer',
            status: 'active',
            name: 'Zoe'
        });

        const agent = await adminAgent();
        const res = await agent.get('/api/users').expect(200);

        expect(res.body.total).toBe(3);
        const nameless = res.body.items.find(
            (m: { email: string }) => m.email === 'nameless@example.com'
        );
        expect(nameless.name).toBeNull();
        // `ORDER BY name` is ascending, where Postgres sorts NULLs last, so
        // the unnamed member lands at the end rather than at the front.
        expect(res.body.items.at(-1).email).toBe('nameless@example.com');
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

    it('rejects page 0 with 400', async () => {
        // Pagination is 1-based, and `(page - 1) * pageSize` turns a 0 into a
        // negative OFFSET — which Postgres rejects at the driver, i.e. a 500
        // from a link anyone can type. `@Min(1)` is what keeps it a 400.
        const agent = await adminAgent();
        await agent.get('/api/users?page=0').expect(400);
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
