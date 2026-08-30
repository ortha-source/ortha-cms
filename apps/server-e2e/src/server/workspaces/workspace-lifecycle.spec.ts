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
    seedArticles,
    seedMembership,
    seedUserWithPermissions,
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

        it('403s for an unknown workspace (never 404 — no id enumeration)', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .post(
                    '/api/workspaces/00000000-0000-0000-0000-000000000000/archive'
                )
                .expect(403);
        });

        it('forbids an admin who is not a member of the workspace', async () => {
            const { agent: owner } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(owner);
            const { agent: outsider } = await loginAs(
                'admin',
                'wsl-outsider@example.com'
            );
            await outsider.post(`/api/workspaces/${id}/archive`).expect(403);
        });

        it('still accepts content writes while archived', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            await agent.post(`/api/workspaces/${id}/archive`).expect(201);

            // Archiving is a **label**: it hides a workspace from the switcher
            // and says "we are done with this", and that is the whole of it.
            // Nothing in the write path reads `status` — no guard, no writer —
            // so an archived workspace still takes entries. Worth pinning
            // because the word invites the opposite assumption, and a
            // read-only-when-archived rule would have to be a decision, not an
            // accident.
            await agent
                .post('/api/content/test_article')
                .set('X-Workspace-Id', id)
                .send({
                    values: {
                        text: 'Written after archiving',
                        select: 'article'
                    }
                })
                .expect(201);

            const after = await agent
                .get(`/api/workspaces/${id}/content/test_article/entry-count`)
                .expect(200);
            expect(after.body).toEqual({ count: 1 });
        });
    });

    describe('DELETE /api/workspaces/:id', () => {
        it('deletes a workspace and records workspace.deleted', async () => {
            const { user, agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            await agent.delete(`/api/workspaces/${id}`).expect(204);

            // It's gone from the list.
            const list = await agent.get('/api/workspaces').expect(200);
            expect(list.body.some((ws: { id: string }) => ws.id === id)).toBe(
                false
            );

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

        it('403s for an unknown workspace (never 404 — no id enumeration)', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .delete('/api/workspaces/00000000-0000-0000-0000-000000000000')
                .expect(403);
        });

        it('forbids an admin who is not a member from deleting it', async () => {
            const { agent: owner } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(owner);
            const { agent: outsider } = await loginAs(
                'admin',
                'wsl-outsider2@example.com'
            );
            await outsider.delete(`/api/workspaces/${id}`).expect(403);

            // Still there for its member.
            const list = await owner.get('/api/workspaces').expect(200);
            expect(list.body.some((ws: { id: string }) => ws.id === id)).toBe(
                true
            );
        });

        it('forbids the entry-count read for a non-member admin', async () => {
            const { agent: owner } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(owner);
            const { agent: outsider } = await loginAs(
                'admin',
                'wsl-outsider3@example.com'
            );
            await outsider.get(`/api/workspaces/${id}/entry-count`).expect(403);
        });

        it('refuses (409) to delete a workspace that still has content entries', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            // Empty workspace: the total entry count is zero.
            const empty = await agent
                .get(`/api/workspaces/${id}/entry-count`)
                .expect(200);
            expect(empty.body).toEqual({ count: 0 });

            // Create a real article entry. Membership alone is not access —
            // the workspace has to be granted the type as well
            // (`ContentGrantGuard`), so grant it first.
            await agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
                .expect(201);
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
            expect(list.body.some((ws: { id: string }) => ws.id === id)).toBe(
                true
            );
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

    describe('the two counters are gated separately', () => {
        it('serves the per-type count to workspaces:update and refuses the workspace count', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);

            // No system role expresses this split — `admin` holds both keys and
            // `contributor` holds neither — so the role is built for the test.
            // The split is the point: the per-type count backs the *revoke*
            // pre-check (`workspaces:update`) and the workspace count backs the
            // *delete* pre-check (`workspaces:delete`), and each read is gated
            // by the change it is a pre-check for. A single "workspace reads"
            // permission would hand a revoker the delete UI's answer.
            const editor = await seedUserWithPermissions(harness.app, {
                email: 'wsl-updater@example.com',
                password: PASSWORD,
                roleKey: 'wsl-updater',
                permissions: ['workspaces:update']
            });
            await seedMembership(editor.id, id);

            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: 'wsl-updater@example.com', password: PASSWORD })
                .expect(201);

            await agent.get(`/api/workspaces/${id}/entry-count`).expect(403);
            const perType = await agent
                .get(`/api/workspaces/${id}/content/test_article/entry-count`)
                .expect(200);
            expect(perType.body).toEqual({ count: 0 });
        });
    });

    describe('with no content plugin bound', () => {
        it('refuses both destructive routes with 503 while the counters read 0', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            // Real rows, written while the content plugin was installed. The
            // `content_*` tables are created by migrations and outlive any one
            // boot's plugin list, which is exactly how a host ends up asking a
            // question it can no longer answer.
            await seedArticles([{ text: 'still here', select: 'a' }], id);

            // The same database, booted without the content plugin — so
            // `CONTENT_ENTRY_COUNTER` is unbound.
            const contentless = await createTestApp({ omitContent: true });
            try {
                const offline = request.agent(contentless.server);
                await offline
                    .post('/api/auth/login')
                    .send({ email: ADMIN_EMAIL, password: PASSWORD })
                    .expect(201);

                // The reads keep their documented fallback: `0` is a fine
                // answer for a pre-check that only ever enables a button.
                await offline
                    .get(`/api/workspaces/${id}/entry-count`)
                    .expect(200)
                    .expect({ count: 0 });
                await offline
                    .get(
                        `/api/workspaces/${id}/content/test_article/entry-count`
                    )
                    .expect(200)
                    .expect({ count: 0 });

                // The writes must not: a destructive change that trusted that
                // `0` would delete a workspace whose rows are sitting in the
                // database it is connected to. Fail closed — 503, not 204.
                await offline.delete(`/api/workspaces/${id}`).expect(503);
                await offline
                    .delete(`/api/workspaces/${id}/content/test_article`)
                    .expect(503);
            } finally {
                // `app.close()`, not `closeTestApp`: the database handle is a
                // module singleton shared with this file's own harness, and
                // `closeDatabase` would end the pool underneath it.
                await contentless.app.close();
            }

            // Nothing changed — the workspace and its grant are both intact
            // for the app that can still count.
            const list = await agent.get('/api/workspaces').expect(200);
            const workspace = list.body.find(
                (ws: { id: string }) => ws.id === id
            );
            expect(workspace).toBeDefined();
            expect(workspace.content).toContain('test_article');
        });
    });
});
