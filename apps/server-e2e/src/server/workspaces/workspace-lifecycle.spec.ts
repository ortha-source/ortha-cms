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
const ADMIN_EMAIL = 'wsl-admin@example.com';

function validBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        members: [],
        content: { mode: 'all' },
        ...overrides
    };
}

/**
 * Workspace lifecycle: archive / unarchive (`workspaces:update`) and permanent
 * delete (`workspaces:delete`), plus the `workspace.archived` /
 * `workspace.unarchived` / `workspace.deleted` audit events and the permission
 * matrix.
 */
describe('Workspace lifecycle (archive / unarchive / delete)', () => {
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
            .send(validBody())
            .expect(201);
        return res.body.id as string;
    }

    describe('POST /api/workspaces/:id/archive', () => {
        it('archives a workspace and records workspace.archived', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            const res = await agent
                .post(`/api/workspaces/${id}/archive`)
                .expect(201);
            expect(res.body.status).toBe('archived');

            const archived = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.archived'
            );
            expect(archived).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                actorEmail: ADMIN_EMAIL
            });
        });

        it('is idempotent — archiving an archived workspace records nothing new', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            await agent.post(`/api/workspaces/${id}/archive`).expect(201);
            await agent.post(`/api/workspaces/${id}/archive`).expect(201);

            const archived = (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.archived'
            );
            expect(archived).toHaveLength(1);
        });

        it('unarchives back to active and records workspace.unarchived', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            await agent.post(`/api/workspaces/${id}/archive`).expect(201);

            const res = await agent
                .post(`/api/workspaces/${id}/unarchive`)
                .expect(201);
            expect(res.body.status).toBe('active');

            const unarchived = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.unarchived'
            );
            expect(unarchived).toMatchObject({ subjectId: id });
        });

        it('forbids a contributor (lacks workspaces:update) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const { agent } = await loginAs(
                'contributor',
                'wsl-contrib@example.com'
            );
            await agent.post(`/api/workspaces/${id}/archive`).expect(403);
        });

        it('404s for an unknown workspace', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .post(
                    '/api/workspaces/00000000-0000-0000-0000-000000000000/archive'
                )
                .expect(404);
        });
    });

    describe('DELETE /api/workspaces/:id', () => {
        it('deletes a workspace and records workspace.deleted', async () => {
            const { user, agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            await agent.delete(`/api/workspaces/${id}`).expect(204);

            // It's gone from the list.
            const list = await agent.get('/api/workspaces').expect(200);
            expect(
                list.body.some((ws: { id: string }) => ws.id === id)
            ).toBe(false);

            const deleted = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.deleted'
            );
            expect(deleted).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                actorId: user.id,
                actorEmail: ADMIN_EMAIL,
                meta: { name: 'Marketing site', slug: 'marketing-site' }
            });
        });

        it('forbids a contributor (lacks workspaces:delete) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const { agent } = await loginAs(
                'contributor',
                'wsl-contrib2@example.com'
            );
            await agent.delete(`/api/workspaces/${id}`).expect(403);
        });

        it('404s for an unknown workspace', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .delete('/api/workspaces/00000000-0000-0000-0000-000000000000')
                .expect(404);
        });

        it('refuses (409) to delete a workspace that still has content entries', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            // Empty workspace: the total entry count is zero.
            const empty = await agent
                .get(`/api/workspaces/${id}/entry-count`)
                .expect(200);
            expect(empty.body).toEqual({ count: 0 });

            // Create a real article entry (the creator is a member of the
            // workspace it was created in, so the write is allowed).
            await agent
                .post('/api/content/test_article')
                .set('X-Workspace-Id', id)
                .send({ values: { text: 'Hello world', select: 'article' } })
                .expect(201);

            const after = await agent
                .get(`/api/workspaces/${id}/entry-count`)
                .expect(200);
            expect(after.body).toEqual({ count: 1 });

            // Delete is refused while the workspace still holds content.
            await agent.delete(`/api/workspaces/${id}`).expect(409);

            // It's still there.
            const list = await agent.get('/api/workspaces').expect(200);
            expect(
                list.body.some((ws: { id: string }) => ws.id === id)
            ).toBe(true);
        });

        it('forbids the entry-count read for a contributor (lacks workspaces:delete) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const { agent } = await loginAs(
                'contributor',
                'wsl-contrib3@example.com'
            );
            await agent.get(`/api/workspaces/${id}/entry-count`).expect(403);
        });
    });
});
