import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    getActivityRows,
    resetDb,
    seedActiveUser,
    type SeededUser,
    type SystemRoleKey
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN_EMAIL = 'wsc-admin@example.com';

/** A create body granting **no** content, so tests add grants explicitly. */
function emptyContentBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        members: [],
        content: { mode: 'specific' },
        ...overrides
    };
}

/**
 * `POST /api/workspaces/:id/content` + `DELETE /api/workspaces/:id/content/:slug`
 * — grant and revoke a workspace's access to a content type. Covers the grant +
 * `workspace.content_granted` event, the unknown-slug 400, revoke-when-empty +
 * `workspace.content_revoked`, the **refuse-when-not-empty 409** (a real entry is
 * created first), and the permission matrix.
 */
describe('Workspace content grants', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
    });

    async function loginAs(
        role: SystemRoleKey,
        email: string
    ): Promise<{ user: SeededUser; agent: ReturnType<typeof request.agent> }> {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return { user, agent };
    }

    async function createWorkspace(
        agent: ReturnType<typeof request.agent>
    ): Promise<string> {
        const res = await agent
            .post('/api/workspaces')
            .send(emptyContentBody())
            .expect(201);
        return res.body.id as string;
    }

    describe('POST /api/workspaces/:id/content', () => {
        it('grants a content type and records workspace.content_granted', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            const res = await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);
            expect(res.body.content).toContain('test_article');

            const granted = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.content_granted'
            );
            expect(granted).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                actorEmail: ADMIN_EMAIL,
                meta: { slug: 'test_article' }
            });
        });

        it('is idempotent — re-granting records nothing new', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);
            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);

            const granted = (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.content_granted'
            );
            expect(granted).toHaveLength(1);
        });

        it('400s for an unknown content-type slug', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'not_a_real_type' })
                .expect(400);
        });

        it('forbids a viewer (lacks workspaces:update) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const { agent } = await loginAs('viewer', 'wsc-viewer@example.com');
            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(403);
        });
    });

    describe('DELETE /api/workspaces/:id/content/:slug', () => {
        it('revokes an empty content type and records workspace.content_revoked', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);

            const res = await agent
                .delete(`/api/workspaces/${id}/content/test_article`)
                .expect(200);
            expect(res.body.content).not.toContain('test_article');

            const revoked = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.content_revoked'
            );
            expect(revoked).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                meta: { slug: 'test_article' }
            });
        });

        it('refuses (409) to revoke a type that still has entries in the workspace', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);

            // Create a real article entry in the workspace (the creator is a
            // member, so the workspace-scoped write is allowed).
            await agent
                .post('/api/content/test_article')
                .set('X-Workspace-Id', id)
                .send({ values: { text: 'Hello world', select: 'article' } })
                .expect(201);

            await agent
                .delete(`/api/workspaces/${id}/content/test_article`)
                .expect(409);

            // The grant is untouched and no revoke was recorded.
            const list = await agent.get('/api/workspaces').expect(200);
            const workspace = list.body.find(
                (ws: { id: string }) => ws.id === id
            );
            expect(workspace.content).toContain('test_article');
            const revoked = (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.content_revoked'
            );
            expect(revoked).toHaveLength(0);
        });

        it('is a no-op (200) when the type was never granted', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            const res = await agent
                .delete(`/api/workspaces/${id}/content/test_article`)
                .expect(200);
            expect(res.body.content ?? []).not.toContain('test_article');

            const revoked = (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.content_revoked'
            );
            expect(revoked).toHaveLength(0);
        });

        it('forbids a viewer (lacks workspaces:update) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            await admin
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);
            const { agent } = await loginAs('viewer', 'wsc-viewer2@example.com');
            await agent
                .delete(`/api/workspaces/${id}/content/test_article`)
                .expect(403);
        });
    });

    describe('GET /api/workspaces/:id/content/:slug/entry-count', () => {
        it('reports zero for an empty type and the live count after a create', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            const empty = await agent
                .get(`/api/workspaces/${id}/content/test_article/entry-count`)
                .expect(200);
            expect(empty.body).toEqual({ count: 0 });

            await agent
                .post('/api/content/test_article')
                .set('X-Workspace-Id', id)
                .send({ values: { text: 'Hello world', select: 'article' } })
                .expect(201);

            const after = await agent
                .get(`/api/workspaces/${id}/content/test_article/entry-count`)
                .expect(200);
            expect(after.body).toEqual({ count: 1 });
        });

        it('forbids a viewer (lacks workspaces:update) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const { agent } = await loginAs('viewer', 'wsc-viewer3@example.com');
            await agent
                .get(`/api/workspaces/${id}/content/test_article/entry-count`)
                .expect(403);
        });
    });
});
