import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedMembership,
    seedUserWithPermissions,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';
import { reloadSegmentCatalogue } from '../../support/segments';

const ADMIN = 'usage-admin@example.com';
const OUTSIDER = 'usage-outsider@example.com';
const NO_SEGMENTS = 'usage-no-segments@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * Where an audience is used (`GET /api/segments/:id/usage`).
 *
 * The audience page lists the entries naming an audience beside its form, and
 * its delete confirmation spells out what changes for each. Entry titles are
 * content of one workspace, so the route is workspace-scoped: these suites pin
 * that a session only ever learns about the entries of the workspace in its
 * `X-Workspace-Id`, and only when it is a member of it.
 */
describe('Segment usage (/api/segments/:id/usage)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceA: string;
    let workspaceB: string;
    let acme: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await reloadSegmentCatalogue(harness.app);
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        const outsider = await seedActiveUser(harness.app, {
            email: OUTSIDER,
            password: PASSWORD,
            role: 'viewer'
        });
        const noSegments = await seedUserWithPermissions(harness.app, {
            email: NO_SEGMENTS,
            password: PASSWORD,
            roleKey: 'usage-no-segments',
            permissions: ['content:read']
        });
        workspaceA = (await seedWorkspace({ name: 'A', slug: 'ws-a' })).id;
        workspaceB = (await seedWorkspace({ name: 'B', slug: 'ws-b' })).id;
        await seedMembership(admin.id, workspaceA);
        await seedMembership(admin.id, workspaceB);
        await seedMembership(outsider.id, workspaceB);
        await seedMembership(noSegments.id, workspaceA);
        await seedAllContentGrants(workspaceA);
        await seedAllContentGrants(workspaceB);

        const agent = await login(ADMIN);
        const created = await agent
            .post('/api/segments')
            .send({ key: 'acme', label: 'Acme Corp' })
            .expect(201);
        acme = created.body.id as string;
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Create one entry in `workspaceId`, naming the audience on one side. */
    async function entry(
        agent: request.Agent,
        workspaceId: string,
        text: string,
        side: 'allow' | 'deny'
    ): Promise<string> {
        const response = await agent
            .post('/api/content/test_article')
            .set('X-Workspace-Id', workspaceId)
            .send({
                values: { text, select: 'article' },
                extensions: {
                    access: {
                        allow: side === 'allow' ? [acme] : [],
                        deny: side === 'deny' ? [acme] : []
                    }
                }
            })
            .expect(201);
        return response.body.id as string;
    }

    it('names the entries of the workspace asked about, with the side each is on', async () => {
        const agent = await login(ADMIN);
        const pricing = await entry(
            agent,
            workspaceA,
            'Enterprise pricing',
            'allow'
        );
        const rivals = await entry(
            agent,
            workspaceA,
            'Competitor comparison',
            'deny'
        );
        await entry(agent, workspaceB, 'Elsewhere', 'allow');

        const response = await agent
            .get(`/api/segments/${acme}/usage`)
            .set('X-Workspace-Id', workspaceA)
            .expect(200);

        expect(response.body.total).toBe(2);
        expect(response.body.truncated).toBe(false);
        expect(
            (
                response.body.items as {
                    entryId: string;
                    title: string;
                    state: string;
                }[]
            ).map(({ entryId, title, state }) => ({ entryId, title, state }))
        ).toEqual(
            expect.arrayContaining([
                {
                    entryId: pricing,
                    title: 'Enterprise pricing',
                    state: 'allow'
                },
                {
                    entryId: rivals,
                    title: 'Competitor comparison',
                    state: 'deny'
                }
            ])
        );
        // The other workspace's entry is never named here.
        expect(JSON.stringify(response.body)).not.toContain('Elsewhere');
    });

    it('answers 403 for a workspace the caller is not a member of', async () => {
        const admin = await login(ADMIN);
        await entry(admin, workspaceA, 'Enterprise pricing', 'allow');

        const outsider = await login(OUTSIDER);
        await outsider
            .get(`/api/segments/${acme}/usage`)
            .set('X-Workspace-Id', workspaceA)
            .expect(403);
    });

    it('needs segments:read', async () => {
        const agent = await login(NO_SEGMENTS);
        await agent
            .get(`/api/segments/${acme}/usage`)
            .set('X-Workspace-Id', workspaceA)
            .expect(403);
    });

    it('needs a workspace', async () => {
        const agent = await login(ADMIN);
        await agent.get(`/api/segments/${acme}/usage`).expect(400);
    });

    it('answers 404 for an audience that does not exist', async () => {
        const agent = await login(ADMIN);
        await agent
            .get('/api/segments/00000000-0000-4000-8000-000000000000/usage')
            .set('X-Workspace-Id', workspaceA)
            .expect(404);
    });

    it('is empty once the audience is no longer named', async () => {
        const agent = await login(ADMIN);
        const id = await entry(
            agent,
            workspaceA,
            'Enterprise pricing',
            'allow'
        );
        await agent
            .put(`/api/segments/entries/${id}`)
            .set('X-Workspace-Id', workspaceA)
            .send({ typeSlug: 'test_article', allow: [], deny: [] })
            .expect(200);

        const response = await agent
            .get(`/api/segments/${acme}/usage`)
            .set('X-Workspace-Id', workspaceA)
            .expect(200);
        expect(response.body).toEqual({
            segmentId: acme,
            total: 0,
            items: [],
            truncated: false
        });
    });
});
