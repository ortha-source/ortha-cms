import request from 'supertest';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@ortha-cms/database';
import { workspaceContent } from '@ortha-cms/identity-server';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';

const ADMIN_EMAIL = 'content-types-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** The code-defined types registered with ContentPlugin (see apps/server/src/content.ts). */
const REGISTRY_NAMES = ['article', 'landing'];

interface Descriptor {
    name: string;
    kind: 'collection' | 'single';
    label?: string;
    path?: string;
}

/**
 * `GET /api/content-types` + the workspace content-grant flow, after the
 * handover: both resolve against the content plugin's code-defined registry
 * (via the `CONTENT_CATALOG` port), not identity's built-in mock catalogue.
 */
describe('Content catalogue handover (GET /api/content-types + grants)', () => {
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

    async function loginAdmin() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('401s an unauthenticated request', async () => {
        await request(harness.server).get('/api/content-types').expect(401);
    });

    it('serves the code-defined registry, not the mock catalogue', async () => {
        const agent = await loginAdmin();
        const res = await agent.get('/api/content-types').expect(200);

        const names = (res.body as Descriptor[]).map((d) => d.name).sort();
        expect(names).toEqual(REGISTRY_NAMES);
        // The retired mock's slugs must not leak through.
        expect(names).not.toContain('blog_post');
        expect(names).not.toContain('product');

        const byName = Object.fromEntries(
            (res.body as Descriptor[]).map((d) => [d.name, d])
        );
        expect(byName.landing).toMatchObject({ kind: 'single', path: '/' });
        expect(byName.article).toMatchObject({ kind: 'collection' });
    });

    it('grants a workspace the real registry slugs on content mode "all"', async () => {
        const agent = await loginAdmin();
        const res = await agent
            .post('/api/workspaces')
            .send({
                name: 'Marketing site',
                slug: 'marketing-site',
                description: 'Landing pages and the blog.',
                color: 'violet',
                members: [],
                content: { mode: 'all' }
            })
            .expect(201);

        const rows = await getDatabase()
            .select()
            .from(workspaceContent)
            .where(eq(workspaceContent.workspaceId, res.body.id));

        expect(rows.map((r) => r.slug).sort()).toEqual(REGISTRY_NAMES);
        // article is the collection; landing is the single.
        const kindBySlug = Object.fromEntries(
            rows.map((r) => [r.slug, r.kind])
        );
        expect(kindBySlug.article).toBe('collection');
        expect(kindBySlug.landing).toBe('single');
    });
});
