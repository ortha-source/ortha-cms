import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedUserWithEmptyRole,
    type SeededUser,
    type SystemRoleKey
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';

/** A valid create-workspace body for `slug`, with optional field overrides. */
function validBody(
    slug: string,
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        name: slug,
        slug,
        description: `The ${slug} workspace.`,
        color: 'violet',
        members: [],
        content: { mode: 'all' },
        ...overrides
    };
}

/**
 * The **tenancy boundary**: membership — not the global role — decides which
 * workspaces a user can see and act on.
 *
 * Two rules, enforced independently of `@RequirePermissions`:
 *
 * 1. `GET /api/workspaces` returns only the caller's own workspaces, so the
 *    admin sidebar / switcher / command palette / home widgets that render from
 *    it can never show someone else's workspace — and the list can't be used to
 *    enumerate ids.
 * 2. Every `/api/workspaces/:id/…` route 403s a non-member, even one holding
 *    `workspaces:update` / `workspaces:delete`. An unknown id is
 *    indistinguishable from one the caller doesn't belong to.
 */
describe('Workspace access is scoped to membership', () => {
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

    /** Seed a user of `role`, log them in, and return the user + cookie agent. */
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

    /** Create a workspace as `agent` (who becomes its first member). */
    async function createWorkspace(
        agent: ReturnType<typeof request.agent>,
        slug: string
    ): Promise<string> {
        const res = await agent
            .post('/api/workspaces')
            .send(validBody(slug))
            .expect(201);
        return res.body.id as string;
    }

    /** The ids `agent` sees in `GET /api/workspaces`. */
    async function listedIds(
        agent: ReturnType<typeof request.agent>
    ): Promise<string[]> {
        const res = await agent.get('/api/workspaces').expect(200);
        return (res.body as { id: string }[]).map((w) => w.id);
    }

    describe('GET /api/workspaces', () => {
        it('returns only the workspaces the caller belongs to', async () => {
            const { agent: alice } = await loginAs('admin', 'wsa-a@example.com');
            const { agent: bob } = await loginAs('admin', 'wsa-b@example.com');

            const aliceWorkspace = await createWorkspace(alice, 'alice-space');
            const bobWorkspace = await createWorkspace(bob, 'bob-space');

            expect(await listedIds(alice)).toEqual([aliceWorkspace]);
            expect(await listedIds(bob)).toEqual([bobWorkspace]);
        });

        it('is empty for a user who belongs to no workspace', async () => {
            const { agent: alice } = await loginAs('admin', 'wsa-a@example.com');
            await createWorkspace(alice, 'alice-space');

            const { agent: outsider } = await loginAs(
                'admin',
                'wsa-outsider@example.com'
            );
            expect(await listedIds(outsider)).toEqual([]);
        });

        it('starts returning a workspace once the user is added to it', async () => {
            const { agent: alice } = await loginAs('admin', 'wsa-a@example.com');
            const id = await createWorkspace(alice, 'alice-space');

            const { user: bob, agent: bobAgent } = await loginAs(
                'viewer',
                'wsa-b@example.com'
            );
            expect(await listedIds(bobAgent)).toEqual([]);

            await alice
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: bob.id })
                .expect(201);

            expect(await listedIds(bobAgent)).toEqual([id]);
        });

        it('requires workspaces:read', async () => {
            await seedUserWithEmptyRole(harness.app, {
                email: 'wsa-norole@example.com',
                password: PASSWORD,
                roleKey: 'wsa-empty-role'
            });
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: 'wsa-norole@example.com', password: PASSWORD })
                .expect(201);

            await agent.get('/api/workspaces').expect(403);
        });
    });

    describe('/api/workspaces/:id/… as a non-member', () => {
        /**
         * Alice owns a workspace; Bob is an `admin` (so he holds every
         * workspace permission) who belongs only to his own. Every assertion
         * below is therefore about membership, never about permissions.
         */
        async function twoTenants() {
            const { agent: alice } = await loginAs('admin', 'wsa-a@example.com');
            const { agent: bob } = await loginAs('admin', 'wsa-b@example.com');
            const aliceWorkspace = await createWorkspace(alice, 'alice-space');
            await createWorkspace(bob, 'bob-space');
            return { alice, bob, aliceWorkspace };
        }

        it('forbids reading the other tenant’s entry counts', async () => {
            const { bob, aliceWorkspace } = await twoTenants();

            await bob
                .get(`/api/workspaces/${aliceWorkspace}/entry-count`)
                .expect(403);
            await bob
                .get(
                    `/api/workspaces/${aliceWorkspace}/content/test_article/entry-count`
                )
                .expect(403);
        });

        it('forbids editing, archiving, and deleting it', async () => {
            const { bob, aliceWorkspace } = await twoTenants();

            await bob
                .patch(`/api/workspaces/${aliceWorkspace}`)
                .send({ name: 'Hijacked' })
                .expect(403);
            await bob
                .post(`/api/workspaces/${aliceWorkspace}/archive`)
                .expect(403);
            await bob
                .post(`/api/workspaces/${aliceWorkspace}/unarchive`)
                .expect(403);
            await bob.delete(`/api/workspaces/${aliceWorkspace}`).expect(403);
        });

        it('forbids changing its members', async () => {
            const { alice, bob, aliceWorkspace } = await twoTenants();

            // Alice's own membership id, discovered from her (scoped) list.
            const res = await alice.get('/api/workspaces').expect(200);
            const [aliceMember] = res.body.find(
                (w: { id: string }) => w.id === aliceWorkspace
            ).members;

            await bob
                .post(`/api/workspaces/${aliceWorkspace}/members`)
                .send({ userId: aliceMember.id })
                .expect(403);
            await bob
                .delete(
                    `/api/workspaces/${aliceWorkspace}/members/${aliceMember.id}`
                )
                .expect(403);
        });

        it('forbids granting and revoking its content types', async () => {
            const { bob, aliceWorkspace } = await twoTenants();

            await bob
                .post(`/api/workspaces/${aliceWorkspace}/content`)
                .send({ slug: 'test_article' })
                .expect(403);
            await bob
                .delete(
                    `/api/workspaces/${aliceWorkspace}/content/test_article`
                )
                .expect(403);
        });

        it('leaves the workspace untouched after every rejected call', async () => {
            const { alice, bob, aliceWorkspace } = await twoTenants();

            await bob
                .patch(`/api/workspaces/${aliceWorkspace}`)
                .send({ name: 'Hijacked' })
                .expect(403);

            const res = await alice.get('/api/workspaces').expect(200);
            const workspace = res.body.find(
                (w: { id: string }) => w.id === aliceWorkspace
            );
            expect(workspace.name).toBe('alice-space');
            expect(workspace.members).toHaveLength(1);
        });
    });
});
