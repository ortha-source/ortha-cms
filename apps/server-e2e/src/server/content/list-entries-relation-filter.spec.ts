import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedArticleTags,
    seedArticles,
    seedAuthors,
    seedMembership,
    seedTags,
    seedWorkspace,
    softDeleteAuthors,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'rel-filter-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** Shape of one item in the list envelope (only the asserted bits). */
interface EntryItem {
    id: string;
    values: Record<string, unknown>;
}

const textsOf = (res: { body: { items: EntryItem[] } }): string[] =>
    res.body.items.map((item) => String(item.values.text)).sort();

/**
 * `GET /api/content/:typeName` **filtering across relations**, plus
 * `GET /api/content-schema/:name/filter-fields`. This is the end-to-end proof
 * of the relation-aware filter surface: a rule on `author.name` (a many-to-one)
 * or `tags.name` (a many-to-many) resolves through an EXISTS subquery, and that
 * subquery is **scoped** — it never traverses a soft-deleted or cross-workspace
 * target (the correctness fix the unit tests can only approximate). The unit
 * layer pins the SQL shape and the parse/whitelist; this pins the real rows a
 * real Postgres returns.
 */
describe('Content relation filtering (GET /api/content/:typeName?filter=)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;
    let smithId: string;
    let jonesId: string;
    // Article ids by their `text`, captured at seed time for tag wiring.
    let articleId: Record<string, string>;

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

        // Two authors; three articles — two by Smith, one by Jones.
        [smithId, jonesId] = await seedAuthors(
            [{ name: 'Smith' }, { name: 'Jones' }],
            workspaceId
        );
        const [alpha, bravo, charlie] = await seedArticles(
            [
                { text: 'Alpha', select: 'article', author: smithId },
                { text: 'Bravo', select: 'tutorial', author: smithId },
                { text: 'Charlie', select: 'article', author: jonesId }
            ],
            workspaceId
        );
        articleId = { Alpha: alpha, Bravo: bravo, Charlie: charlie };
    });

    async function login(email: string, workspace: string = workspaceId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace);
        return agent;
    }

    /** A single-rule `?filter=` query string for `field op value`. */
    const rule = (field: string, op: string, value: unknown) =>
        JSON.stringify({ field, op, value });

    describe('many-to-one (author.name)', () => {
        it('filters entries by a related record field', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article')
                .query({ filter: rule('author.name', 'ilike', '%smith%') })
                .expect(200);

            expect(res.body.total).toBe(2);
            expect(textsOf(res)).toEqual(['Alpha', 'Bravo']);
        });

        it('excludes a soft-deleted target (the relation scope)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const filter = rule('author.name', 'ilike', '%smith%');

            const before = await agent
                .get('/api/content/test_article')
                .query({ filter })
                .expect(200);
            expect(before.body.total).toBe(2);

            // Tombstone the author. Without the soft-delete guard inside the
            // EXISTS, the two articles would still match a now-deleted author.
            await softDeleteAuthors([smithId]);

            const after = await agent
                .get('/api/content/test_article')
                .query({ filter })
                .expect(200);
            expect(after.body.total).toBe(0);
        });

        it('excludes a target in another workspace (the workspace scope)', async () => {
            // A second workspace with its OWN author also named "Smith", and an
            // article in THIS workspace deliberately linked across to it.
            const wsB = await seedWorkspace({ name: 'WS Two', slug: 'ws-two' });
            await seedMembership(admin.id, wsB.id);
            const [smithB] = await seedAuthors([{ name: 'Smith' }], wsB.id);
            await seedArticles(
                [{ text: 'Echo', select: 'article', author: smithB }],
                workspaceId
            );

            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article')
                .query({ filter: rule('author.name', 'ilike', '%smith%') })
                .expect(200);

            // Only the two articles whose author lives in THIS workspace; the
            // cross-workspace link to wsB's "Smith" is not matched.
            expect(res.body.total).toBe(2);
            expect(textsOf(res)).toEqual(['Alpha', 'Bravo']);
        });
    });

    describe('many-to-many (tags.*)', () => {
        beforeEach(async () => {
            const [red, blue] = await seedTags(
                [
                    { name: 'red', slug: 'red' },
                    { name: 'blue', slug: 'blue' }
                ],
                workspaceId
            );
            await seedArticleTags(articleId.Alpha, [red, blue]);
            await seedArticleTags(articleId.Charlie, [red]);
        });

        it('filters by a tag field with EXISTS semantics (no row duplication)', async () => {
            const agent = await login(ADMIN_EMAIL);
            // Alpha has {red, blue}, Charlie has {red}. Matching either tag must
            // still return each article exactly once (EXISTS, not a join).
            const res = await agent
                .get('/api/content/test_article')
                .query({ filter: rule('tags.slug', 'in', ['red', 'blue']) })
                .expect(200);

            expect(res.body.total).toBe(2);
            expect(textsOf(res)).toEqual(['Alpha', 'Charlie']);
        });

        it('matches only entries linked to the given tag', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article')
                .query({ filter: rule('tags.name', 'eq', 'blue') })
                .expect(200);

            expect(res.body.total).toBe(1);
            expect(textsOf(res)).toEqual(['Alpha']);
        });
    });

    describe('composition + bounds', () => {
        it('combines a root field and a relation path under OR', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article')
                .query({
                    filter: JSON.stringify({
                        or: [
                            { field: 'select', op: 'eq', value: 'tutorial' },
                            { field: 'author.name', op: 'ilike', value: '%jones%' }
                        ]
                    })
                })
                .expect(200);

            // Bravo (tutorial) ∪ Charlie (by Jones).
            expect(res.body.total).toBe(2);
            expect(textsOf(res)).toEqual(['Bravo', 'Charlie']);
        });

        it('400s an unknown field under a relation', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/test_article')
                .query({ filter: rule('author.bogus', 'eq', 'x') })
                .expect(400);
        });

        it('400s a path deeper than the relation-hop budget', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/test_article')
                .query({ filter: rule('author.name.deep.deeper', 'eq', 'x') })
                .expect(400);
        });
    });
});

/**
 * `GET /api/content-schema/:name/filter-fields` — the surface the admin's query
 * builder renders. Built by the same traversal as the SQL whitelist, so every
 * path here is one the list endpoint accepts (the unit `drift` test pins the
 * converse); this just proves the route is wired, permissioned, and shaped.
 */
describe('Filter fields (GET /api/content-schema/:name/filter-fields)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;

    interface WireField {
        path: string;
        label: string;
        type: string;
        enumValues?: string[];
        group: string[];
        relationTarget?: string;
    }

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
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    it('401s an unauthenticated request', async () => {
        await request(harness.server)
            .get('/api/content-schema/test_article/filter-fields')
            .expect(401);
    });

    it('404s an unknown content type', async () => {
        const agent = await login();
        await agent
            .get('/api/content-schema/does-not-exist/filter-fields')
            .expect(404);
    });

    it('returns the recursive filterable surface', async () => {
        const agent = await login();
        const res = await agent
            .get('/api/content-schema/test_article/filter-fields')
            .expect(200);

        const fields = res.body.fields as WireField[];
        const byPath = new Map(fields.map((f) => [f.path, f]));

        // A root enum field, ungrouped.
        expect(byPath.get('select')).toMatchObject({
            type: 'enum',
            enumValues: ['article', 'tutorial', 'changelog'],
            group: []
        });

        // The publishable status envelope.
        expect(byPath.get('status')?.type).toBe('enum');

        // A many-to-one relation field, grouped under its relation label.
        expect(byPath.get('author.name')).toMatchObject({
            type: 'string',
            group: ['Author']
        });

        // The relation's record-picker entry carries the target type name.
        expect(byPath.get('author.id')).toMatchObject({
            type: 'uuid',
            relationTarget: 'test_author',
            group: ['Author']
        });

        // A many-to-many relation field is offered too.
        expect(byPath.get('tags.name')).toMatchObject({
            type: 'string',
            group: ['Tags']
        });
    });
});
