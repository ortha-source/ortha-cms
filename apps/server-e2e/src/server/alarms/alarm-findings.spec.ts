import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { drainOutbox } from '../../support/outbox';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'alarm-findings-admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * Published articles with no `number`.
 *
 * A rule has to be about an **optional** field to be worth writing: `text` and
 * `select` are required, so an article missing one cannot be published in the
 * first place and the publish gate already covers it. `number` is exactly the
 * case alarms exist for — schema-optional, and something a workspace may still
 * want filled in before a piece ships.
 */
const NO_NUMBER_FILTER = {
    and: [
        { field: 'status', op: 'eq', value: 'published' },
        { field: 'number', op: 'null', value: true }
    ]
};

/** The values every fixture article needs in order to publish at all. */
const REQUIRED_VALUES = { text: 'A body', select: 'article' };

let harness: TestApp;

beforeAll(async () => {
    harness = await createTestApp();
});

afterAll(async () => {
    await closeTestApp(harness);
});

/**
 * The finding **lifecycle**, driven by real entry writes.
 *
 * This is the half a unit test cannot reach: findings are produced by an outbox
 * subscriber reacting to `entry.*` events, and the two behaviours that make the
 * feature usable rather than noisy — above all a finding closing itself — is
 * only observable once a real write has gone through the real event path.
 */
describe('Alarm findings lifecycle', () => {
    let admin: SeededUser;
    let workspaceId: string;
    let ruleId: string;

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        const workspace = await seedWorkspace({
            name: 'Findings',
            slug: 'findings'
        });
        workspaceId = workspace.id;
        await seedMembership(admin.id, workspaceId);
        await seedAllContentGrants(workspaceId);
    });

    /** A logged-in agent carrying the workspace header the routes require. */
    async function api() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    /** Create the fixture rule and remember its id. */
    async function createRule(client: Awaited<ReturnType<typeof api>>) {
        const res = await client
            .post('/api/alarms/rules')
            .send({
                contentType: 'test_article',
                name: 'Published with no number',
                findingTitle: 'This is published without a number',
                severity: 'warn',
                filter: NO_NUMBER_FILTER
            })
            .expect(201);
        ruleId = res.body.rule.id;
        return res.body.rule.id as string;
    }

    /** Create an article through the API and publish it. */
    async function publishArticle(
        client: Awaited<ReturnType<typeof api>>,
        values: Record<string, unknown> = {}
    ): Promise<string> {
        const created = await client
            .post('/api/content/test_article')
            .send({ values: { ...REQUIRED_VALUES, ...values } })
            .expect(201);
        const id = created.body.id as string;
        await client
            .post(`/api/content/test_article/${id}/publish`)
            .expect(201);
        return id;
    }

    /**
     * Rewrite an article's values and publish it again.
     *
     * The admin's `PATCH` **replaces** the values bag, and editing a published
     * entry takes it back to draft — so a fixture change is always
     * "patch the whole document, then publish", never a partial write.
     */
    async function rewriteAndPublish(
        client: Awaited<ReturnType<typeof api>>,
        entryId: string,
        values: Record<string, unknown>
    ): Promise<void> {
        await client
            .patch(`/api/content/test_article/${entryId}`)
            .send({ values: { ...REQUIRED_VALUES, ...values } })
            .expect(200);
        await client
            .post(`/api/content/test_article/${entryId}/publish`)
            .expect(201);
    }

    it('opens a finding when a matching entry is published', async () => {
        const client = await api();
        await createRule(client);

        const entryId = await publishArticle(client);
        await drainOutbox(harness.app);

        const findings = await client.get('/api/alarms/findings').expect(200);
        expect(findings.body.total).toBe(1);
        expect(findings.body.items[0]).toMatchObject({
            ruleId,
            entryId,
            state: 'open',
            severity: 'warn',
            title: 'This is published without a number'
        });
    });

    it('closes the finding by itself once the entry is fixed', async () => {
        const client = await api();
        await createRule(client);
        const entryId = await publishArticle(client);
        await drainOutbox(harness.app);
        expect((await client.get('/api/alarms/findings')).body.total).toBe(1);

        // Fill the number in. Nobody touches the alarms feature; the entry
        // write alone has to close the finding.
        await rewriteAndPublish(client, entryId, { number: 5 });
        await drainOutbox(harness.app);

        const after = await client.get('/api/alarms/findings').expect(200);
        expect(after.body.total).toBe(0);
    });

    it('is idempotent under a re-delivered event', async () => {
        const client = await api();
        await createRule(client);
        await publishArticle(client);

        // At-least-once delivery: draining twice must not produce a second row.
        await drainOutbox(harness.app);
        await drainOutbox(harness.app);

        expect((await client.get('/api/alarms/findings')).body.total).toBe(1);
    });

    it('has no mute route left to call', async () => {
        const client = await api();
        await createRule(client);
        const entryId = await publishArticle(client);
        await drainOutbox(harness.app);

        // Muting existed and was withdrawn. Leaving the route behind the
        // removed UI would be a capability nothing exercises and nobody
        // reviews — reachable by anyone who remembers the URL, and the first
        // thing to rot.
        await client
            .put(`/api/alarms/findings/${ruleId}/${entryId}/mute`)
            .send({ reason: 'this one is a stub on purpose' })
            .expect(404);
        await client
            .delete(`/api/alarms/findings/${ruleId}/${entryId}/mute`)
            .expect(404);

        // And `muted` is no longer a state the list will filter by.
        await client.get('/api/alarms/findings?state=muted').expect(400);
    });

    it('serves findings for a batch of entries in one request', async () => {
        const client = await api();
        await createRule(client);
        const first = await publishArticle(client);
        const second = await publishArticle(client, { number: 7 });
        await drainOutbox(harness.app);

        const res = await client
            .get(`/api/alarms/findings/by-entry?entryIds=${first},${second}`)
            .expect(200);

        expect(Object.keys(res.body.byEntry)).toEqual([first]);
        expect(res.body.byEntry[first]).toHaveLength(1);
    });

    it('reports the open counts by severity for the workspace', async () => {
        const client = await api();
        await createRule(client);
        await publishArticle(client);
        await drainOutbox(harness.app);

        const summary = await client
            .get('/api/alarms/findings/summary')
            .expect(200);
        expect(summary.body).toMatchObject({
            openTotal: 1,
            open: { error: 0, warn: 1, info: 0 }
        });
        expect(summary.body).not.toHaveProperty('muted');
    });

    it('closes the findings on an entry when it is deleted', async () => {
        const client = await api();
        await createRule(client);
        const entryId = await publishArticle(client);
        await drainOutbox(harness.app);
        expect((await client.get('/api/alarms/findings')).body.total).toBe(1);

        await client.delete(`/api/content/test_article/${entryId}`).expect(204);
        await drainOutbox(harness.app);

        expect((await client.get('/api/alarms/findings')).body.total).toBe(0);
    });
});
