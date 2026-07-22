import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedUserWithEmptyRole
} from '../../support/seed';

const ADMIN_EMAIL = 'content-admin@example.com';
const NORIGHTS_EMAIL = 'content-norights@example.com';
const PASSWORD = 'SecurePass123!';

/** The serialized relation shape served under each field. */
interface SerializedRelation {
    to: string;
    many: boolean;
    onDelete?: string;
}
interface SerializedField {
    name: string;
    type: string;
    required: boolean;
    options?: string[];
    relation?: SerializedRelation;
}

/**
 * `GET /api/content-schema` + `/:name` — the read API the admin's dynamic
 * tables/forms render from. Covers its `content:read` gate (401 anon, 403 for a
 * role without the permission), the list/detail shapes, and the 404 path.
 */
describe('Content schema (GET /api/content-schema)', () => {
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

    describe('authorization', () => {
        it('401s an unauthenticated list request', async () => {
            await request(harness.server)
                .get('/api/content-schema')
                .expect(401);
        });

        it('401s an unauthenticated detail request', async () => {
            await request(harness.server)
                .get('/api/content-schema/test_article')
                .expect(401);
        });

        it('403s an authenticated user whose role lacks content:read', async () => {
            await seedUserWithEmptyRole(harness.app, {
                email: NORIGHTS_EMAIL,
                password: PASSWORD,
                roleKey: 'content-spec-no-perms'
            });
            const agent = await login(NORIGHTS_EMAIL);
            await agent.get('/api/content-schema').expect(403);
            await agent.get('/api/content-schema/test_article').expect(403);
        });
    });

    describe('list', () => {
        it('returns a summary of every code-defined content type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent.get('/api/content-schema').expect(200);

            const names = res.body.map((t: { name: string }) => t.name).sort();
            // Every e2e-owned type (see support/content/index.ts): test_article
            // plus its test_author/test_seo/test_tag/test_comment reference
            // collections, the test_landing single, and the self-referential
            // test_page tree.
            expect(names).toEqual([
                'test_article',
                'test_author',
                'test_comment',
                'test_landing',
                'test_page',
                'test_seo',
                'test_tag'
            ]);

            const landing = res.body.find(
                (t: { name: string }) => t.name === 'test_landing'
            );
            expect(landing).toMatchObject({ kind: 'single', path: '/' });
            const article = res.body.find(
                (t: { name: string }) => t.name === 'test_article'
            );
            expect(article).toMatchObject({
                kind: 'collection',
                label: 'Articles'
            });
            // Summaries carry no field schema.
            expect(article.fields).toBeUndefined();
        });
    });

    describe('detail', () => {
        it('returns the full field schema for a type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content-schema/test_article')
                .expect(200);

            expect(res.body.name).toBe('test_article');
            const byName: Record<string, SerializedField> = Object.fromEntries(
                (res.body.fields as SerializedField[]).map((f) => [f.name, f])
            );
            // The reference collection exercises every scalar field type.
            expect(byName.text).toMatchObject({ type: 'text', required: true });
            expect(byName.number).toMatchObject({ type: 'number' });
            expect(byName.select).toMatchObject({
                type: 'select',
                required: true
            });
            // The serialized `select` carries its declared options.
            expect(byName.select.options).toEqual([
                'article',
                'tutorial',
                'changelog'
            ]);
        });

        it('404s an unknown content type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent.get('/api/content-schema/does-not-exist').expect(404);
        });
    });
});
