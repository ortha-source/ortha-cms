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
const ADMIN_EMAIL = 'wsu-admin@example.com';

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
 * `PATCH /api/workspaces/:id` — the workspace profile edit (name / description /
 * color). Covers the happy path + the `workspace.updated` audit event, the
 * empty-patch no-op, permission (403), and unknown workspace (404).
 */
describe('Update workspace (PATCH /api/workspaces/:id)', () => {
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

    it('updates name, description, and color and records workspace.updated', async () => {
        const { user, agent } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(agent);

        const res = await agent
            .patch(`/api/workspaces/${id}`)
            .send({
                name: 'Marketing hub',
                description: 'Now with docs.',
                color: 'teal'
            })
            .expect(200);
        expect(res.body).toMatchObject({
            id,
            name: 'Marketing hub',
            description: 'Now with docs.',
            color: 'teal',
            // Untouched by an edit — still its original slug.
            slug: 'marketing-site'
        });

        const updated = (await getActivityRows()).find(
            (row) => row.kind === 'workspace.updated'
        );
        expect(updated).toMatchObject({
            subjectType: 'workspace',
            subjectId: id,
            actorId: user.id,
            actorEmail: ADMIN_EMAIL
        });
        // The changed field names ride on `meta.fields`.
        expect((updated?.meta as { fields?: string[] } | null)?.fields).toEqual(
            expect.arrayContaining(['name', 'description', 'color'])
        );
    });

    it('applies a partial patch, leaving unspecified fields intact', async () => {
        const { agent } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(agent);

        const res = await agent
            .patch(`/api/workspaces/${id}`)
            .send({ name: 'Renamed only' })
            .expect(200);
        expect(res.body).toMatchObject({
            name: 'Renamed only',
            // Description + color are unchanged from creation.
            description: 'Landing pages and the blog.',
            color: 'violet'
        });
    });

    it('is a no-op for an empty patch and records nothing', async () => {
        const { agent } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(agent);

        await agent.patch(`/api/workspaces/${id}`).send({}).expect(200);

        const updates = (await getActivityRows()).filter(
            (row) => row.kind === 'workspace.updated'
        );
        expect(updates).toHaveLength(0);
    });

    it('rejects a color outside the seven-key palette, leaving the old one', async () => {
        const { agent } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(agent);

        await agent
            .patch(`/api/workspaces/${id}`)
            .send({ color: 'chartreuse' })
            .expect(400);

        // A rejected patch is not a partial one: the workspace keeps the color
        // it had, and nothing was recorded.
        const res = await agent.get('/api/workspaces').expect(200);
        expect(res.body.find((w: { id: string }) => w.id === id).color).toBe(
            'violet'
        );
        expect(
            (await getActivityRows()).filter(
                (row) => row.kind === 'workspace.updated'
            )
        ).toHaveLength(0);
    });

    it('rejects a slug in the patch body and leaves the slug alone', async () => {
        const { agent } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(agent);

        // The slug is the workspace's stable URL identifier, so
        // `UpdateWorkspaceDto` simply does not carry it — and the global pipe
        // is `forbidNonWhitelisted`, which turns "silently ignored" into 400.
        // The difference matters: a client that thought it renamed a slug and
        // got a 200 would be wrong in a way nothing tells it about.
        await agent
            .patch(`/api/workspaces/${id}`)
            .send({ name: 'Renamed', slug: 'renamed' })
            .expect(400);

        const res = await agent.get('/api/workspaces').expect(200);
        expect(res.body.find((w: { id: string }) => w.id === id)).toMatchObject(
            { name: 'Marketing site', slug: 'marketing-site' }
        );
    });

    it('forbids a contributor (lacks workspaces:update) with 403', async () => {
        const { agent: admin } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(admin);
        const { agent } = await loginAs(
            'contributor',
            'wsu-contrib@example.com'
        );
        await agent
            .patch(`/api/workspaces/${id}`)
            .send({ name: 'Nope' })
            .expect(403);
    });

    it('403s for an unknown workspace (never 404 — no id enumeration)', async () => {
        const { agent } = await loginAs('admin', ADMIN_EMAIL);
        // `WorkspaceMemberGuard` runs before the handler, so a caller who is
        // not a member cannot tell an unknown id from one they simply don't
        // belong to. Both are a flat 403.
        await agent
            .patch('/api/workspaces/00000000-0000-0000-0000-000000000000')
            .send({ name: 'Ghost' })
            .expect(403);
    });

    it('forbids an admin who is not a member of the workspace', async () => {
        const { agent: owner } = await loginAs('admin', ADMIN_EMAIL);
        const id = await createWorkspace(owner);

        // A second admin holds `workspaces:update` but belongs to no
        // workspace — permissions say *what*, membership says *where*.
        const { agent: outsider } = await loginAs(
            'admin',
            'wsu-outsider@example.com'
        );
        await outsider
            .patch(`/api/workspaces/${id}`)
            .send({ name: 'Hijacked' })
            .expect(403);

        // The workspace is untouched.
        const res = await owner.get('/api/workspaces').expect(200);
        expect(res.body.find((w: { id: string }) => w.id === id).name).toBe(
            'Marketing site'
        );
    });
});
