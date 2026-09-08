import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const AUTHOR = 'queue-author@example.com';
const OTHER_AUTHOR = 'queue-other-author@example.com';
const REVIEWER = 'queue-reviewer@example.com';

/**
 * `GET /api/protection/queue` — how a reviewer learns there is work.
 *
 * Without it approvals exist and nobody knows they are wanted. It spans every
 * content type in the workspace, which is why it is a page of its own rather
 * than a saved view of one collection's records list.
 */
describe('/api/protection/queue', () => {
    let harness: TestApp;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        workspace = await seedWorkspace({ name: 'Press', slug: 'press' });
        await seedContentGrants(workspace.id, ['test_article', 'test_author']);
    });

    async function member(
        email: string,
        role: 'admin' | 'contributor' | 'viewer',
        ws: SeededWorkspace = workspace
    ): Promise<{ user: SeededUser; agent: ReturnType<typeof request.agent> }> {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        await seedMembership(user.id, ws.id);
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', ws.id);
        return { user, agent };
    }

    /** Create an entry of `type` and open a review request on it. */
    async function askFor(
        agent: ReturnType<typeof request.agent>,
        type: 'test_article' | 'test_author',
        values: Record<string, unknown>
    ): Promise<string> {
        const created = await agent
            .post(`/api/content/${type}`)
            .send({ values })
            .expect(201);
        const id = created.body.id as string;
        await agent
            .post(`/api/protection/entries/${type}/${id}/request`)
            .send({})
            .expect(201);
        return id;
    }

    it('is empty when nobody has asked for anything', async () => {
        const { agent } = await member(REVIEWER, 'contributor');
        const response = await agent.get('/api/protection/queue').expect(200);
        expect(response.body).toEqual({ items: [], total: 0 });
    });

    it('lists open requests across every content type in the workspace', async () => {
        const { agent: author } = await member(AUTHOR, 'contributor');
        const articleId = await askFor(author, 'test_article', {
            text: 'Quarterly results',
            select: 'article'
        });
        const authorId = await askFor(author, 'test_author', {
            text: 'A new byline'
        });

        const { agent: reviewer } = await member(REVIEWER, 'contributor');
        const response = await reviewer
            .get('/api/protection/queue')
            .expect(200);

        expect(response.body.total).toBe(2);
        const ids = response.body.items.map(
            (item: { entryId: string }) => item.entryId
        );
        expect(ids.sort()).toEqual([articleId, authorId].sort());
        expect(Object.keys(response.body.items[0]).sort()).toEqual([
            'contentType',
            'createdAt',
            'entryId',
            'given',
            'id',
            'note',
            'requestedBy',
            'required'
        ]);
    });

    /**
     * `?mine=1` is "what did I send", not "what is waiting on me". The second
     * question has no server-side answer worth trusting: anyone with
     * `content:approve` may review anything, so "waiting on me" is everything
     * minus what I already voted on — which the client computes from `given`
     * and its own identity.
     */
    it('narrows to the caller’s own requests with ?mine=1', async () => {
        const { agent: mine } = await member(AUTHOR, 'contributor');
        const myEntry = await askFor(mine, 'test_article', {
            text: 'Mine',
            select: 'article'
        });

        const { agent: theirs } = await member(OTHER_AUTHOR, 'contributor');
        await askFor(theirs, 'test_article', {
            text: 'Theirs',
            select: 'article'
        });

        const all = await mine.get('/api/protection/queue').expect(200);
        expect(all.body.total).toBe(2);

        const onlyMine = await mine
            .get('/api/protection/queue?mine=1')
            .expect(200);
        expect(onlyMine.body.total).toBe(1);
        expect(onlyMine.body.items[0].entryId).toBe(myEntry);
    });

    it('drops a request once it is withdrawn', async () => {
        const { agent } = await member(AUTHOR, 'contributor');
        const id = await askFor(agent, 'test_article', {
            text: 'Withdrawn',
            select: 'article'
        });

        await agent
            .delete(`/api/protection/entries/test_article/${id}/request`)
            .expect(204);

        const response = await agent.get('/api/protection/queue').expect(200);
        expect(response.body).toEqual({ items: [], total: 0 });
    });

    it('does not leak another workspace’s queue', async () => {
        const { agent } = await member(AUTHOR, 'contributor');
        await askFor(agent, 'test_article', {
            text: 'Press only',
            select: 'article'
        });

        const other = await seedWorkspace({ name: 'Other', slug: 'other' });
        await seedContentGrants(other.id, ['test_article']);
        const { agent: outsider } = await member(
            REVIEWER,
            'contributor',
            other
        );

        const response = await outsider
            .get('/api/protection/queue')
            .expect(200);
        expect(response.body).toEqual({ items: [], total: 0 });
    });

    it('is refused without a session', async () => {
        await request(harness.server)
            .get('/api/protection/queue')
            .set('X-Workspace-Id', workspace.id)
            .expect(401);
    });

    it('rejects an unknown query parameter', async () => {
        const { agent } = await member(REVIEWER, 'contributor');
        await agent.get('/api/protection/queue?urgent=1').expect(400);
    });
});
