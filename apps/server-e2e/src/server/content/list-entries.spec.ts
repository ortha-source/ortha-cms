import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedArticles,
    seedLanding,
    seedUserWithEmptyRole
} from '../../support/seed';

const ADMIN_EMAIL = 'entries-admin@example.com';
const NORIGHTS_EMAIL = 'entries-norights@example.com';
const PASSWORD = 'SecurePass123!';

/** Shape of one item in the list envelope (only the asserted bits). */
interface EntryItem {
    id: string;
    status?: string;
    values: Record<string, unknown>;
}

/**
 * `GET /api/content/:typeName` — the generic records-list endpoint the admin's
 * dynamic table reads. Covers its `content:read` gate, the search/filter/sort/
 * paginate pipeline against a real generated table, the unknown-type 404, the
 * page-size cap, and the publishable-only `status` behaviour (present + filterable
 * on `article`, absent + unfilterable on the non-publishable `landing`).
 */
describe('Content entries (GET /api/content/:typeName)', () => {
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
        await seedArticles([
            { text: 'Alpha', select: 'article', status: 'published' },
            { text: 'Bravo', select: 'tutorial', status: 'draft' },
            { text: 'Charlie', select: 'article', status: 'published' }
        ]);
        await seedLanding([{ text: 'Home page', select: 'light' }]);
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    describe('authorization', () => {
        it('401s an unauthenticated request', async () => {
            await request(harness.server)
                .get('/api/content/article')
                .expect(401);
        });

        it('403s a user whose role lacks content:read', async () => {
            await seedUserWithEmptyRole(harness.app, {
                email: NORIGHTS_EMAIL,
                password: PASSWORD,
                roleKey: 'entries-spec-no-perms'
            });
            const agent = await login(NORIGHTS_EMAIL);
            await agent.get('/api/content/article').expect(403);
        });
    });

    describe('list pipeline', () => {
        it('returns the paginated envelope', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/article')
                .query({ page: 1, pageSize: 2 })
                .expect(200);

            expect(res.body.total).toBe(3);
            expect(res.body.page).toBe(1);
            expect(res.body.pageSize).toBe(2);
            expect(res.body.items).toHaveLength(2);
        });

        it('searches text-like columns (ILIKE)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/article')
                .query({ search: 'alph' })
                .expect(200);

            expect(res.body.total).toBe(1);
            expect((res.body.items as EntryItem[])[0].values.text).toBe('Alpha');
        });

        it('sorts by a column, descending with the `-` prefix', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/article')
                .query({ sort: '-text' })
                .expect(200);

            const texts = (res.body.items as EntryItem[]).map(
                (item) => item.values.text
            );
            expect(texts).toEqual(['Charlie', 'Bravo', 'Alpha']);
        });

        it('applies the query-builder `?filter=` tree', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/article')
                .query({
                    filter: JSON.stringify({
                        field: 'status',
                        op: 'eq',
                        value: 'published'
                    })
                })
                .expect(200);

            expect(res.body.total).toBe(2);
            for (const item of res.body.items as EntryItem[]) {
                expect(item.status).toBe('published');
            }
        });

        it('404s an unknown content type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent.get('/api/content/does-not-exist').expect(404);
        });

        it('400s a page size over the cap', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/article')
                .query({ pageSize: 9999 })
                .expect(400);
        });
    });

    describe('publishable-only status', () => {
        it('omits `status` for a non-publishable type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent.get('/api/content/landing').expect(200);

            const [item] = res.body.items as EntryItem[];
            expect(item.status).toBeUndefined();
            expect(item.values.text).toBe('Home page');
        });

        it('400s a status filter on a non-publishable type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/landing')
                .query({
                    filter: JSON.stringify({
                        field: 'status',
                        op: 'eq',
                        value: 'published'
                    })
                })
                .expect(400);
        });
    });
});
