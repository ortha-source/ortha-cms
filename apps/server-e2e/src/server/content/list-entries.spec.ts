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
    seedMembership,
    seedUserWithEmptyRole,
    seedWorkspace,
    type SeededUser
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
    let admin: SeededUser;
    // The workspace under test. Every request carries its id as the
    // `X-Workspace-Id` header (set as an agent default in `login`), and the
    // seeded rows below belong to it — without this the WorkspaceGuard hides
    // every entry.
    let workspaceId: string;

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
        const ws = await seedWorkspace({ name: 'WS One', slug: 'ws-one' });
        workspaceId = ws.id;
        await seedMembership(admin.id, workspaceId);
        await seedArticles(
            [
                { text: 'Alpha', select: 'article', status: 'published' },
                { text: 'Bravo', select: 'tutorial', status: 'draft' },
                { text: 'Charlie', select: 'article', status: 'published' }
            ],
            workspaceId
        );
        await seedLanding([{ text: 'Home page', select: 'light' }], workspaceId);
    });

    /**
     * Log in and return an agent that carries both the session cookie and the
     * `X-Workspace-Id` header on every request (`agent.set` registers a default
     * applied to all requests). Pass a `workspace` to scope to a different
     * workspace; defaults to the suite's `workspaceId`.
     */
    async function login(email: string, workspace: string = workspaceId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace);
        return agent;
    }

    describe('authorization', () => {
        it('401s an unauthenticated request', async () => {
            await request(harness.server)
                .get('/api/content/test_article')
                .expect(401);
        });

        it('403s a user whose role lacks content:read', async () => {
            const noRights = await seedUserWithEmptyRole(harness.app, {
                email: NORIGHTS_EMAIL,
                password: PASSWORD,
                roleKey: 'entries-spec-no-perms'
            });
            // Member of the workspace, so the WorkspaceGuard passes and the 403
            // comes from the PermissionsGuard (the missing content:read) — not
            // from a workspace mismatch.
            await seedMembership(noRights.id, workspaceId);
            const agent = await login(NORIGHTS_EMAIL);
            await agent.get('/api/content/test_article').expect(403);
        });
    });

    describe('list pipeline', () => {
        it('returns the paginated envelope', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article')
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
                .get('/api/content/test_article')
                .query({ search: 'alph' })
                .expect(200);

            expect(res.body.total).toBe(1);
            expect((res.body.items as EntryItem[])[0].values.text).toBe('Alpha');
        });

        it('sorts by a column, descending with the `-` prefix', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article')
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
                .get('/api/content/test_article')
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
                .get('/api/content/test_article')
                .query({ pageSize: 9999 })
                .expect(400);
        });
    });

    describe('publishable-only status', () => {
        it('omits `status` for a non-publishable type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent.get('/api/content/test_landing').expect(200);

            const [item] = res.body.items as EntryItem[];
            expect(item.status).toBeUndefined();
            expect(item.values.text).toBe('Home page');
        });

        it('400s a status filter on a non-publishable type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/test_landing')
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

    describe('workspace isolation', () => {
        it("does not leak workspace A's entries when listing with workspace B's header", async () => {
            // A second workspace the SAME admin also belongs to, with its own
            // single article. This is the core regression: the list must filter
            // by the request's workspace, never bleed rows across workspaces.
            const wsB = await seedWorkspace({ name: 'WS Two', slug: 'ws-two' });
            await seedMembership(admin.id, wsB.id);
            await seedArticles(
                [{ text: 'Delta', select: 'article', status: 'published' }],
                wsB.id
            );

            // Workspace A (the suite default) sees only its three rows…
            const agentA = await login(ADMIN_EMAIL);
            const resA = await agentA.get('/api/content/test_article').expect(200);
            expect(resA.body.total).toBe(3);
            const textsA = (resA.body.items as EntryItem[]).map(
                (item) => item.values.text
            );
            expect(textsA.sort()).toEqual(['Alpha', 'Bravo', 'Charlie']);
            expect(textsA).not.toContain('Delta');

            // …and workspace B sees only its one row.
            const agentB = await login(ADMIN_EMAIL, wsB.id);
            const resB = await agentB.get('/api/content/test_article').expect(200);
            expect(resB.body.total).toBe(1);
            expect((resB.body.items as EntryItem[])[0].values.text).toBe(
                'Delta'
            );
        });

        it('400s a request with no X-Workspace-Id header', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);
            // Logged in but no workspace header → WorkspaceGuard 400s.
            await agent.get('/api/content/test_article').expect(400);
        });

        it('400s a malformed (non-UUID) X-Workspace-Id header', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);
            agent.set('X-Workspace-Id', 'not-a-uuid');
            await agent.get('/api/content/test_article').expect(400);
        });

        it('403s a workspace the user is not a member of', async () => {
            // A real workspace, but the admin holds no membership in it.
            const stranger = await seedWorkspace({
                name: 'WS Stranger',
                slug: 'ws-stranger'
            });
            const agent = await login(ADMIN_EMAIL, stranger.id);
            await agent.get('/api/content/test_article').expect(403);
        });
    });
});
