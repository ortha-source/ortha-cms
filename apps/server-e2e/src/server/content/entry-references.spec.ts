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
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'entry-references-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** A valid `test_article` payload. */
const VALID = { text: 'Hello world', select: 'article' } as const;

type Reference = {
    typeName: string;
    field: string;
    count: number;
    live: number;
    onPurge: 'unlink' | 'delete' | 'block';
};

/**
 * `GET /api/content/:type/:id/references` — which records in this workspace
 * link to an entry, and what a permanent delete would do to them. The admin
 * asks it before a delete or a purge; a delete used to go through with no word
 * about what pointed at the record.
 */
describe('Entry references (/api/content/:type/:id/references)', () => {
    let harness: TestApp;
    let workspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        const admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        const ws = await seedWorkspace({ name: 'WS One', slug: 'ws-one' });
        workspaceId = ws.id;
        await seedMembership(admin.id, workspaceId);
        await seedAllContentGrants(workspaceId);
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function create(
        agent: request.Agent,
        type: string,
        values: Record<string, unknown>
    ): Promise<string> {
        const res = await agent
            .post(`/api/content/${type}`)
            .send({ values })
            .expect(201);
        return res.body.id as string;
    }

    async function referencesOf(
        agent: request.Agent,
        type: string,
        id: string
    ): Promise<{ items: Reference[]; total: number; live: number }> {
        return (
            await agent.get(`/api/content/${type}/${id}/references`).expect(200)
        ).body;
    }

    it('counts the referrers per field, and how many of them are live [content:I-58]', async () => {
        const agent = await login();
        const tag = await create(agent, 'test_tag', { name: 'News' });
        const draft = await create(agent, 'test_article', {
            ...VALID,
            tags: [tag]
        });
        const live = await create(agent, 'test_article', {
            ...VALID,
            tags: [tag]
        });
        await agent
            .post(`/api/content/test_article/${live}/publish`)
            .expect(201);

        const view = await referencesOf(agent, 'test_tag', tag);
        expect(view).toMatchObject({ total: 2, live: 1 });
        expect(view.items).toEqual([
            expect.objectContaining({
                typeName: 'test_article',
                field: 'tags',
                count: 2,
                live: 1,
                // A join row cascades: purging the tag only drops the link.
                onPurge: 'unlink'
            })
        ]);
        expect(draft).toBeTruthy();
    });

    it('says what a purge does through each foreign key', async () => {
        const agent = await login();
        const article = await create(agent, 'test_article', VALID);
        await create(agent, 'test_comment', {
            author: 'Ada',
            body: '<p>Nice</p>',
            article
        });

        const view = await referencesOf(agent, 'test_article', article);
        // `test_comment.article` is required, so its FK cascades: purging the
        // article deletes the comment with it — the one a person must be told.
        expect(view.items).toEqual([
            expect.objectContaining({
                typeName: 'test_comment',
                field: 'article',
                count: 1,
                live: 1,
                onPurge: 'delete'
            })
        ]);
    });

    it('ignores referrers in the trash, and answers for a target in the trash', async () => {
        const agent = await login();
        const tag = await create(agent, 'test_tag', { name: 'News' });
        const kept = await create(agent, 'test_article', {
            ...VALID,
            tags: [tag]
        });
        const binned = await create(agent, 'test_article', {
            ...VALID,
            tags: [tag]
        });
        await agent.delete(`/api/content/test_article/${binned}`).expect(204);
        // The purge is confirmed from the trash, so the target may be there.
        await agent.delete(`/api/content/test_tag/${tag}`).expect(204);

        const view = await referencesOf(agent, 'test_tag', tag);
        expect(view.total).toBe(1);
        expect(kept).toBeTruthy();
    });

    it('answers an empty list when nothing links to the entry', async () => {
        const agent = await login();
        const tag = await create(agent, 'test_tag', { name: 'Lonely' });
        expect(await referencesOf(agent, 'test_tag', tag)).toEqual({
            items: [],
            total: 0,
            live: 0
        });
    });

    it('404s an id that is not an entry of this workspace', async () => {
        const agent = await login();
        await agent
            .get(
                '/api/content/test_tag/00000000-0000-4000-8000-000000000000/references'
            )
            .expect(404);
    });
});
