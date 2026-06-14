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
    seedUser,
    type SeededUser,
    type SystemRoleKey
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN_EMAIL = 'wsm-admin@example.com';

/** A valid create-workspace body, with optional field overrides. */
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
 * Workspace creation + the manage-members endpoints
 * (`POST`/`DELETE /api/workspaces/:id/members`) and the three workspace audit
 * events they record in-band: `workspace.created`, `workspace.member_added`,
 * `workspace.member_removed`.
 */
describe('Workspace members + activity', () => {
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

    describe('workspace.created', () => {
        it('records workspace.created when an admin creates a workspace', async () => {
            const { user, agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);

            const rows = await getActivityRows();
            const created = rows.find(
                (row) => row.kind === 'workspace.created'
            );
            expect(created).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                actorId: user.id,
                actorEmail: ADMIN_EMAIL,
                meta: { name: 'Marketing site', slug: 'marketing-site' }
            });
        });
    });

    describe('POST /api/workspaces/:id/members', () => {
        it('adds a member and records workspace.member_added', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });

            const res = await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: member.id })
                .expect(201);
            expect(
                res.body.members.some(
                    (m: { id: string }) => m.id === member.id
                )
            ).toBe(true);

            const added = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.member_added'
            );
            expect(added).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                actorEmail: ADMIN_EMAIL,
                meta: { userId: member.id, email: 'member@example.com' }
            });
        });

        it('is idempotent — re-adding a member records nothing new', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });

            await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: member.id })
                .expect(201);
            await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: member.id })
                .expect(201);

            const added = (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.member_added'
            );
            expect(added).toHaveLength(1);
        });

        it('404s for an unknown workspace', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });
            await agent
                .post(
                    '/api/workspaces/00000000-0000-0000-0000-000000000000/members'
                )
                .send({ userId: member.id })
                .expect(404);
        });

        it('404s for an unknown user', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: '00000000-0000-0000-0000-000000000000' })
                .expect(404);
        });

        it('forbids a contributor (lacks workspaces:update) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });
            const { agent } = await loginAs(
                'contributor',
                'wsm-contributor@example.com'
            );
            await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: member.id })
                .expect(403);
        });
    });

    describe('DELETE /api/workspaces/:id/members/:userId', () => {
        it('removes a member and records workspace.member_removed', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });
            await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: member.id })
                .expect(201);

            await agent
                .delete(`/api/workspaces/${id}/members/${member.id}`)
                .expect(204);

            const removed = (await getActivityRows()).find(
                (row) => row.kind === 'workspace.member_removed'
            );
            expect(removed).toMatchObject({
                subjectType: 'workspace',
                subjectId: id,
                actorEmail: ADMIN_EMAIL,
                meta: { userId: member.id, email: 'member@example.com' }
            });
        });

        it('is a no-op (204) and records nothing when not a member', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(agent);
            const stranger = await seedUser(harness.app, {
                email: 'stranger@example.com',
                role: 'viewer',
                status: 'active'
            });

            await agent
                .delete(`/api/workspaces/${id}/members/${stranger.id}`)
                .expect(204);

            const removed = (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.member_removed'
            );
            expect(removed).toHaveLength(0);
        });

        it('forbids a viewer (lacks workspaces:update) with 403', async () => {
            const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
            const id = await createWorkspace(admin);
            const member = await seedUser(harness.app, {
                email: 'member@example.com',
                role: 'viewer',
                status: 'active'
            });
            const { agent } = await loginAs('viewer', 'wsm-viewer@example.com');
            await agent
                .delete(`/api/workspaces/${id}/members/${member.id}`)
                .expect(403);
        });
    });
});
