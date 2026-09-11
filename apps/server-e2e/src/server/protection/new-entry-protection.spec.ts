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
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';

/**
 * `GET /api/protection/types/:type` — what publishing a **new** entry would
 * meet.
 *
 * The create form has no entry to read a review of, yet its Publish button
 * creates and publishes in one press. Without this read the editor learns that a
 * rule applies only by having the publish refused after the draft is written.
 */
describe('/api/protection/types', () => {
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
        await seedContentGrants(workspace.id, ['test_article']);
    });

    /** Seed a member of `role`, log them in, and scope the agent to the workspace. */
    async function member(
        email: string,
        role: 'admin' | 'contributor'
    ): Promise<ReturnType<typeof request.agent>> {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        await seedMembership(user.id, workspace.id);
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    /** Write the rule for `test_article` through the real rules route. */
    async function protect(
        admin: ReturnType<typeof request.agent>,
        fields: Record<string, unknown>
    ): Promise<void> {
        await admin
            .put('/api/protection/rules/collection/test_article')
            .send(fields)
            .expect(200);
    }

    /** Create an entry through the real content API and return its id. */
    async function createEntry(
        agent: ReturnType<typeof request.agent>
    ): Promise<string> {
        const created = await agent
            .post('/api/content/test_article')
            .send({ values: { text: 'A new article', select: 'article' } })
            .expect(201);
        return created.body.id as string;
    }

    it('reports an unprotected type as needing nothing', async () => {
        const contributor = await member('new-a@example.com', 'contributor');

        const response = await contributor
            .get('/api/protection/types/test_article')
            .expect(200);

        expect(response.body).toEqual({
            protected: false,
            required: 0,
            given: 0,
            blocked: false,
            bypassable: false
        });
    });

    it('holds a new entry of a protected type, and offers only an administrator the way past', async () => {
        const admin = await member('new-admin@example.com', 'admin');
        await protect(admin, { enabled: true, requiredApprovals: 2 });
        const contributor = await member('new-b@example.com', 'contributor');

        await contributor
            .get('/api/protection/types/test_article')
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    protected: true,
                    required: 2,
                    given: 0,
                    blocked: true,
                    bypassable: false
                });
            });

        await admin
            .get('/api/protection/types/test_article')
            .expect(200)
            .expect((res) => {
                expect(res.body).toMatchObject({
                    blocked: true,
                    bypassable: true
                });
            });
    });

    it('offers no administrator a way past a rule that allows no bypass', async () => {
        const admin = await member('new-admin@example.com', 'admin');
        await protect(admin, {
            enabled: true,
            requiredApprovals: 1,
            adminBypass: false
        });

        await admin
            .get('/api/protection/types/test_article')
            .expect(200)
            .expect((res) => {
                expect(res.body).toMatchObject({
                    blocked: true,
                    bypassable: false
                });
            });
    });

    it('reads a switched-off rule as no rule at all', async () => {
        const admin = await member('new-admin@example.com', 'admin');
        await protect(admin, { enabled: false, requiredApprovals: 2 });

        await admin
            .get('/api/protection/types/test_article')
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    protected: false,
                    required: 0,
                    given: 0,
                    blocked: false,
                    bypassable: false
                });
            });
    });

    /** ⭐ The read is a prediction; the guard is what it predicts. Both ways. */
    it('[protection:I-18] predicts the guard for a new entry that will be held', async () => {
        const admin = await member('new-admin@example.com', 'admin');
        await protect(admin, { enabled: true, requiredApprovals: 1 });
        const contributor = await member('new-b@example.com', 'contributor');

        const read = await contributor
            .get('/api/protection/types/test_article')
            .expect(200);
        expect(read.body.blocked).toBe(true);

        const id = await createEntry(contributor);
        await contributor
            .post(`/api/content/test_article/${id}/publish`)
            .expect(409);
    });

    it('[protection:I-18] predicts the guard for a new entry that will go through', async () => {
        const contributor = await member('new-b@example.com', 'contributor');

        const read = await contributor
            .get('/api/protection/types/test_article')
            .expect(200);
        expect(read.body.blocked).toBe(false);

        const id = await createEntry(contributor);
        await contributor
            .post(`/api/content/test_article/${id}/publish`)
            .expect(201);
    });

    it('404s an ungranted type exactly as it 404s an unknown one', async () => {
        const contributor = await member('new-c@example.com', 'contributor');

        await contributor.get('/api/protection/types/test_author').expect(404);
        await contributor.get('/api/protection/types/no_such_type').expect(404);
    });

    it('is refused without a session', async () => {
        await request(harness.server)
            .get('/api/protection/types/test_article')
            .set('X-Workspace-Id', workspace.id)
            .expect(401);
    });
});
