import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { drainOutbox } from '../../support/outbox';
import {
    resetDb,
    seedActiveUser,
    seedContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'inbox-admin@example.com';
const AUTHOR = 'inbox-author@example.com';
const BORIS = 'inbox-boris@example.com';
const CARLA = 'inbox-carla@example.com';

type Agent = ReturnType<typeof request.agent>;

/**
 * `/api/inbox` — what a person was told, across every workspace they belong
 * to, and the producers that put it there (ADR-0023). Booted **without** a mail
 * provider: the inbox works on its own, which is the configuration most
 * deployments start in.
 */
describe('/api/inbox', () => {
    let harness: TestApp;
    let workspace: SeededWorkspace;
    const ids: Record<string, string> = {};

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        workspace = await seedWorkspace({ name: 'Press', slug: 'press' });
        await seedContentGrants(workspace.id, ['test_article']);
        for (const [email, role] of [
            [ADMIN, 'admin'],
            [AUTHOR, 'contributor'],
            [BORIS, 'contributor'],
            [CARLA, 'contributor']
        ] as const) {
            const user = await seedActiveUser(harness.app, {
                email,
                password: PASSWORD,
                role
            });
            await seedMembership(user.id, workspace.id);
            ids[email] = user.id;
        }
    });

    async function login(email: string): Promise<Agent> {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    async function protect(requiredApprovals: number) {
        const admin = await login(ADMIN);
        await admin
            .put('/api/protection/rules/collection/test_article')
            .send({ enabled: true, requiredApprovals })
            .expect(200);
    }

    async function askFor(author: Agent, reviewers: string[]) {
        const created = await author
            .post('/api/content/test_article')
            .send({ values: { text: 'Spring launch', select: 'article' } })
            .expect(201);
        const id = created.body.id as string;
        await author
            .post(`/api/protection/entries/test_article/${id}/request`)
            .send({ reviewerIds: reviewers.map((email) => ids[email]) })
            .expect(201);
        return id;
    }

    it('puts a review request in each reviewer’s inbox, and only theirs', async () => {
        const author = await login(AUTHOR);
        const entryId = await askFor(author, [BORIS]);

        const boris = await login(BORIS);
        const page = await boris.get('/api/inbox').expect(200);
        expect(page.body.nextCursor).toBeNull();
        expect(page.body.items).toEqual([
            expect.objectContaining({
                kind: 'review.requested',
                category: 'reviews',
                workspaceId: workspace.id,
                link: `workspaces/${workspace.id}/reviews`,
                readAt: null,
                payload: expect.objectContaining({
                    entryId,
                    contentType: 'test_article',
                    entryTitle: 'Spring launch',
                    requesterName: AUTHOR
                })
            })
        ]);
        await expect(
            boris.get('/api/inbox/summary').expect(200)
        ).resolves.toMatchObject({
            body: {
                unread: 1,
                byCategory: { reviews: 1, alarms: 0, updates: 0 }
            }
        });

        // Nobody else was asked.
        const carla = await login(CARLA);
        expect((await carla.get('/api/inbox').expect(200)).body.items).toEqual(
            []
        );
    });

    it('marks an item read, and refuses somebody else’s', async () => {
        const author = await login(AUTHOR);
        await askFor(author, [BORIS]);
        const boris = await login(BORIS);
        const [item] = (await boris.get('/api/inbox').expect(200)).body.items;

        const carla = await login(CARLA);
        await carla.post(`/api/inbox/${item.id}/read`).expect(404);

        await boris.post(`/api/inbox/${item.id}/read`).expect(204);
        // Idempotent.
        await boris.post(`/api/inbox/${item.id}/read`).expect(204);
        const summary = await boris.get('/api/inbox/summary').expect(200);
        expect(summary.body.unread).toBe(0);
        const unread = await boris.get('/api/inbox?unread=1').expect(200);
        expect(unread.body.items).toEqual([]);
    });

    it('marks everything read at once', async () => {
        const author = await login(AUTHOR);
        await askFor(author, [BORIS]);
        await askFor(author, [BORIS]);
        const boris = await login(BORIS);

        const marked = await boris.post('/api/inbox/read').send({}).expect(200);

        expect(marked.body).toEqual({ marked: 2 });
        expect(
            (await boris.get('/api/inbox/summary').expect(200)).body.unread
        ).toBe(0);
    });

    it('tells the requester once the last approval lands', async () => {
        await protect(2);
        const author = await login(AUTHOR);
        const entryId = await askFor(author, [BORIS, CARLA]);

        const boris = await login(BORIS);
        await boris
            .post(`/api/protection/entries/test_article/${entryId}/approve`)
            .send({})
            .expect(201);
        expect(
            (await author.get('/api/inbox?category=updates').expect(200)).body
                .items
        ).toEqual([]);

        const carla = await login(CARLA);
        await carla
            .post(`/api/protection/entries/test_article/${entryId}/approve`)
            .send({})
            .expect(201);

        const updates = await author
            .get('/api/inbox?category=updates')
            .expect(200);
        expect(updates.body.items).toEqual([
            expect.objectContaining({
                kind: 'review.ready',
                link: `workspaces/${workspace.id}/content/test_article/${entryId}`,
                payload: expect.objectContaining({ entryId, required: 2 })
            })
        ]);
    });

    it('tells an approver when a save leaves their approval behind', async () => {
        await protect(1);
        const author = await login(AUTHOR);
        const entryId = await askFor(author, [BORIS]);
        const boris = await login(BORIS);
        await boris
            .post(`/api/protection/entries/test_article/${entryId}/approve`)
            .send({})
            .expect(201);

        await author
            .patch(`/api/content/test_article/${entryId}`)
            .send({ values: { text: 'Spring launch, revised' } })
            .expect(200);
        await drainOutbox(harness.app);

        const stale = (
            await boris.get('/api/inbox').expect(200)
        ).body.items.find(
            (item: { kind: string }) => item.kind === 'review.approval_stale'
        );
        expect(stale).toMatchObject({
            category: 'reviews',
            payload: expect.objectContaining({ entryId })
        });
        // A second delivery of the same event stores nothing new.
        await drainOutbox(harness.app);
        const again = (await boris.get('/api/inbox').expect(200)).body.items;
        expect(
            again.filter(
                (item: { kind: string }) =>
                    item.kind === 'review.approval_stale'
            )
        ).toHaveLength(1);
    });

    // Leaving a workspace hides its items rather than deleting them.
    it('lists only workspaces the person still belongs to', async () => {
        const author = await login(AUTHOR);
        await askFor(author, [BORIS]);
        await getPool().query(
            'DELETE FROM memberships WHERE user_id = $1 AND workspace_id = $2',
            [ids[BORIS], workspace.id]
        );

        const boris = await login(BORIS);
        expect((await boris.get('/api/inbox').expect(200)).body.items).toEqual(
            []
        );
        expect(
            (await boris.get('/api/inbox/summary').expect(200)).body.unread
        ).toBe(0);
    });

    it('needs a session', async () => {
        await request(harness.server).get('/api/inbox').expect(401);
    });

    it('refuses a cursor it did not issue', async () => {
        const boris = await login(BORIS);
        await boris.get('/api/inbox?before=nonsense').expect(400);
    });
});
