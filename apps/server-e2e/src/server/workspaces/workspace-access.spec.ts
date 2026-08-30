import { randomUUID } from 'node:crypto';
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
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const PASSWORD = 'SecurePass123!';

/** A logged-in supertest agent carrying its session cookie. */
type Agent = ReturnType<typeof request.agent>;

/** One route call against a workspace id, not yet awaited. */
type RouteCall = (agent: Agent, id: string) => ReturnType<Agent['patch']>;

/** One `/api/workspaces/:id/…` route, as the guard matrices drive it. */
interface IdRoute {
    /** How the case is named in the test report. */
    label: string;
    /** Whether the route mutates — i.e. whether `OriginGuard` is on it. */
    stateChanging: boolean;
    /** Issues the request. */
    call: RouteCall;
}

/**
 * Every `/api/workspaces/:id/…` route, as one call each.
 *
 * The guards are declared per controller, so "all of them agree" is a claim
 * about twelve separate decorator lists — exactly the kind of thing that holds
 * until someone adds the thirteenth controller. Driving them from one table
 * means a new route is either added here or is conspicuously absent.
 *
 * `stateChanging` is the `OriginGuard` line: the two counters are reads and
 * carry no such guard, which is a decision, not an oversight.
 */
const ID_ROUTES: IdRoute[] = [
    {
        label: 'PATCH /:id',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent.patch(`/api/workspaces/${id}`).send({ name: 'Renamed' })
    },
    {
        label: 'POST /:id/archive',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent.post(`/api/workspaces/${id}/archive`)
    },
    {
        label: 'POST /:id/unarchive',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent.post(`/api/workspaces/${id}/unarchive`)
    },
    {
        label: 'DELETE /:id',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent.delete(`/api/workspaces/${id}`)
    },
    {
        label: 'POST /:id/members',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: randomUUID() })
    },
    {
        label: 'DELETE /:id/members/:userId',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent.delete(`/api/workspaces/${id}/members/${randomUUID()}`)
    },
    {
        label: 'POST /:id/content',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent
                .post(`/api/workspaces/${id}/content`)
                .send({ slug: 'test_article' })
    },
    {
        label: 'DELETE /:id/content/:slug',
        stateChanging: true,
        call: (agent: Agent, id: string) =>
            agent.delete(`/api/workspaces/${id}/content/test_article`)
    },
    {
        label: 'GET /:id/entry-count',
        stateChanging: false,
        call: (agent: Agent, id: string) =>
            agent.get(`/api/workspaces/${id}/entry-count`)
    },
    {
        label: 'GET /:id/content/:slug/entry-count',
        stateChanging: false,
        call: (agent: Agent, id: string) =>
            agent.get(`/api/workspaces/${id}/content/test_article/entry-count`)
    }
];

/** `[label, call]` pairs for `it.each`, over the routes matching `predicate`. */
function routeCases(
    predicate: (route: IdRoute) => boolean = () => true
): [string, RouteCall][] {
    return ID_ROUTES.filter(predicate).map((route) => [
        route.label,
        route.call
    ]);
}

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
            const { agent: alice } = await loginAs(
                'admin',
                'wsa-a@example.com'
            );
            const { agent: bob } = await loginAs('admin', 'wsa-b@example.com');

            const aliceWorkspace = await createWorkspace(alice, 'alice-space');
            const bobWorkspace = await createWorkspace(bob, 'bob-space');

            expect(await listedIds(alice)).toEqual([aliceWorkspace]);
            expect(await listedIds(bob)).toEqual([bobWorkspace]);
        });

        it('is empty for a user who belongs to no workspace', async () => {
            const { agent: alice } = await loginAs(
                'admin',
                'wsa-a@example.com'
            );
            await createWorkspace(alice, 'alice-space');

            const { agent: outsider } = await loginAs(
                'admin',
                'wsa-outsider@example.com'
            );
            expect(await listedIds(outsider)).toEqual([]);
        });

        it('starts returning a workspace once the user is added to it', async () => {
            const { agent: alice } = await loginAs(
                'admin',
                'wsa-a@example.com'
            );
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
            const { agent: alice } = await loginAs(
                'admin',
                'wsa-a@example.com'
            );
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

        it('answers the same bytes for "not a member" and "no such workspace"', async () => {
            const { alice, bob, aliceWorkspace } = await twoTenants();

            // The flat 403 is only worth having if the two cases are
            // *indistinguishable*. A different message, a different key order,
            // even a different length would turn the response into the
            // enumeration oracle the guard exists to remove — and every
            // existing assertion in this suite reads the status alone, which
            // cannot see any of that.
            const notAMember = await bob
                .patch(`/api/workspaces/${aliceWorkspace}`)
                .send({ name: 'Hijacked' })
                .expect(403);
            const noSuchWorkspace = await bob
                .patch('/api/workspaces/00000000-0000-0000-0000-000000000000')
                .send({ name: 'Hijacked' })
                .expect(403);

            expect(noSuchWorkspace.text).toBe(notAMember.text);
            // Pinned rather than merely compared: the message is what a client
            // renders, and it must not name the workspace, the caller, or which
            // of the two situations this is.
            expect(notAMember.body).toEqual({
                message: 'You are not a member of this workspace.',
                error: 'Forbidden',
                statusCode: 403
            });
            // The workspace is still Alice's, and still hers alone.
            const res = await alice.get('/api/workspaces').expect(200);
            expect(
                res.body.find((w: { id: string }) => w.id === aliceWorkspace)
                    .name
            ).toBe('alice-space');
        });
    });

    describe('a malformed :id', () => {
        it.each(routeCases())(
            '400s %s',
            async (_label: string, call: RouteCall) => {
                const { agent } = await loginAs('admin', 'wsa-a@example.com');
                await createWorkspace(agent, 'alice-space');

                // `WorkspaceMemberGuard` validates the shape before it probes
                // membership, so a non-uuid is a 400 and never reaches the
                // membership query — which would otherwise blow up in the
                // driver on `invalid input syntax for type uuid` and surface as
                // a 500.
                await call(agent, 'not-a-uuid').expect(400);
            }
        );
    });

    describe('OriginGuard on the /:id routes', () => {
        it.each(routeCases((route) => route.stateChanging))(
            '403s %s from a foreign Origin',
            async (_label: string, call: RouteCall) => {
                const { agent } = await loginAs('admin', 'wsa-a@example.com');
                const id = await createWorkspace(agent, 'alice-space');

                await call(agent, id)
                    .set('Origin', 'https://evil.example')
                    .expect(403);

                // The guard runs first in every chain, so nothing downstream got
                // to touch the row: same name, same status, same sole member, and
                // the workspace still exists after a rejected DELETE.
                const res = await agent.get('/api/workspaces').expect(200);
                const workspace = res.body.find(
                    (w: { id: string }) => w.id === id
                );
                expect(workspace).toMatchObject({
                    name: 'alice-space',
                    status: 'active'
                });
                expect(workspace.members).toHaveLength(1);
            }
        );

        it('still allows the configured app origin', async () => {
            const { agent } = await loginAs('admin', 'wsa-a@example.com');
            const id = await createWorkspace(agent, 'alice-space');

            await agent
                .patch(`/api/workspaces/${id}`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ name: 'Renamed' })
                .expect(200);
        });

        it.each(routeCases((route) => !route.stateChanging))(
            'lets a foreign Origin read %s',
            async (_label: string, call: RouteCall) => {
                const { agent } = await loginAs('admin', 'wsa-a@example.com');
                const id = await createWorkspace(agent, 'alice-space');

                // Reads carry no `OriginGuard`: a cross-site read of a
                // cookie-authenticated endpoint is what `SameSite` stops, and
                // guarding them here would only mean the two counters answered
                // differently from every other GET in the API.
                const res = await call(agent, id)
                    .set('Origin', 'https://evil.example')
                    .expect(200);
                expect(res.body).toEqual({ count: 0 });
            }
        );
    });
});
