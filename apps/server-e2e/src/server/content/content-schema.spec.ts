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
                .get('/api/content-schema/post')
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
            await agent.get('/api/content-schema/post').expect(403);
        });
    });

    describe('list', () => {
        it('returns a summary of every code-defined content type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent.get('/api/content-schema').expect(200);

            const names = res.body.map((t: { name: string }) => t.name).sort();
            expect(names).toEqual(['author', 'home', 'post', 'tag']);

            const home = res.body.find(
                (t: { name: string }) => t.name === 'home'
            );
            expect(home).toMatchObject({ kind: 'single', path: '/' });
            const post = res.body.find(
                (t: { name: string }) => t.name === 'post'
            );
            expect(post).toMatchObject({
                kind: 'collection',
                label: 'Blog posts'
            });
            // Summaries carry no field schema.
            expect(post.fields).toBeUndefined();
        });
    });

    describe('detail', () => {
        it('returns the full field schema for a type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content-schema/post')
                .expect(200);

            expect(res.body.name).toBe('post');
            const byName: Record<string, SerializedField> = Object.fromEntries(
                (res.body.fields as SerializedField[]).map((f) => [f.name, f])
            );
            expect(byName.title).toMatchObject({ type: 'text', required: true });

            // A single relation reports its FK onDelete...
            expect(byName.author.relation).toMatchObject({
                to: 'author',
                many: false,
                onDelete: 'restrict'
            });
            // ...a many relation omits onDelete (join rows always cascade).
            expect(byName.tags.relation).toMatchObject({
                to: 'tag',
                many: true
            });
            expect(byName.tags.relation?.onDelete).toBeUndefined();
        });

        it('404s an unknown content type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent.get('/api/content-schema/does-not-exist').expect(404);
        });
    });
});
