import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { drainMail, resetMail } from '../../support/mail';
import {
    resetDb,
    seedActiveUser,
    seedContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const AUTHOR = 'notice-author@example.com';
const BORIS = 'notice-boris@example.com';
const CARLA = 'notice-carla@example.com';

/** The notices still queued, oldest first. */
async function noticeRows(): Promise<
    { kind: string; toAddress: string; link: string | null; subject: string }[]
> {
    const { rows } = await getPool().query(
        `SELECT kind, to_address AS "toAddress", link, subject
         FROM mail_deliveries
         WHERE kind = 'review_requested'
         ORDER BY created_at ASC`
    );
    return rows;
}

/**
 * A review request mails the people it names — booted **with** a mail
 * provider, the configuration in which a reviewer no longer has to find the
 * Reviews page on their own.
 */
describe('review request mail', () => {
    let harness: TestApp;
    let workspace: SeededWorkspace;
    const ids: Record<string, string> = {};

    beforeAll(async () => {
        harness = await createTestApp({ mail: {} });
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        resetMail();
        workspace = await seedWorkspace({ name: 'Press', slug: 'press' });
        await seedContentGrants(workspace.id, ['test_article']);
        for (const email of [AUTHOR, BORIS, CARLA]) {
            const user = await seedActiveUser(harness.app, {
                email,
                password: PASSWORD,
                role: 'contributor'
            });
            await seedMembership(user.id, workspace.id);
            ids[email] = user.id;
        }
    });

    async function author() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: AUTHOR, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    async function draft(agent: ReturnType<typeof request.agent>) {
        const created = await agent
            .post('/api/content/test_article')
            .send({ values: { text: 'Spring launch', select: 'article' } })
            .expect(201);
        return created.body.id as string;
    }

    it('queues one notice per reviewer, with no link to reveal', async () => {
        const agent = await author();
        const id = await draft(agent);

        await agent
            .post(`/api/protection/entries/test_article/${id}/request`)
            .send({ reviewerIds: [ids[BORIS], ids[CARLA]] })
            .expect(201);

        const rows = await noticeRows();
        expect(rows.map((row) => row.toAddress).sort()).toEqual(
            [BORIS, CARLA].sort()
        );
        // A notice carries no secret, so `reveal-link` has nothing to hand
        // back for it.
        expect(rows.every((row) => row.link === null)).toBe(true);

        const sent = await drainMail(harness.app);
        const toBoris = sent.find((message) => message.to === BORIS);
        expect(toBoris?.subject).toContain('asked you to review');
        expect(toBoris?.text).toContain(`/workspaces/${workspace.id}/reviews`);
        expect(toBoris?.text).toContain('Press');
        expect(await noticeRows()).toEqual([]);
    });

    it('mails only the reviewer a changed request adds', async () => {
        const agent = await author();
        const id = await draft(agent);
        await agent
            .post(`/api/protection/entries/test_article/${id}/request`)
            .send({ reviewerIds: [ids[BORIS]] })
            .expect(201);
        await drainMail(harness.app);
        resetMail();

        await agent
            .post(`/api/protection/entries/test_article/${id}/request`)
            .send({ reviewerIds: [ids[BORIS], ids[CARLA]] })
            .expect(201);

        expect((await noticeRows()).map((row) => row.toAddress)).toEqual([
            CARLA
        ]);
    });

    // The notice is written in the request's own transaction: a request the
    // server refuses tells nobody anything.
    it('queues nothing for a refused request', async () => {
        const agent = await author();
        const id = await draft(agent);

        await agent
            .post(`/api/protection/entries/test_article/${id}/request`)
            .send({ reviewerIds: ['00000000-0000-4000-8000-000000000000'] })
            .expect(422);

        expect(await noticeRows()).toEqual([]);
    });
});
