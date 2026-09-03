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

const ADMIN_EMAIL = 'alarm-edit-admin@example.com';
const PASSWORD = 'SecurePass123!';

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
 * **Editing a rule's condition and getting findings back for the new one.**
 *
 * This is the flow a person actually performs — open a rule, change what it
 * looks for, save — and it is the one the lifecycle suite does not cover: that
 * one creates a rule with its final filter and drives entry events. Here the
 * entries never change; only the rule does, and the findings have to follow.
 */
describe('Editing an alarm rule’s condition', () => {
    let workspaceId: string;

    beforeEach(async () => {
        await resetDb();
        const admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        const workspace = await seedWorkspace({
            name: 'Edit',
            slug: 'edit'
        });
        workspaceId = workspace.id;
        await seedMembership(admin.id, workspaceId);
        await seedAllContentGrants(workspaceId);
    });

    async function api() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    /** Create an article and publish it. */
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
     * The exact shape the admin's query builder emits for
     * "text contains QWERT" — `ilike` with the term wrapped in `%…%`.
     * Hard-coded rather than imported: this asserts the wire contract between
     * the two halves, so a change on either side should break it here.
     */
    const CONTAINS_QWERT = {
        and: [{ field: 'text', op: 'ilike', value: '%QWERT%' }]
    };

    it('rescans with the new condition and opens the findings it implies [alarms:I-07]', async () => {
        const client = await api();
        const hit = await publishArticle(client, { text: 'Has QWERT inside' });
        await publishArticle(client, { text: 'Nothing of the sort' });

        // A rule that starts by matching nothing, so any finding below can only
        // have come from the edit.
        const created = await client
            .post('/api/alarms/rules')
            .send({
                contentType: 'test_article',
                name: 'Should Have',
                findingTitle: 'Title Does not Match',
                severity: 'error',
                filter: {
                    and: [
                        { field: 'text', op: 'ilike', value: '%NOTHINGHERE%' }
                    ]
                }
            })
            .expect(201);
        const ruleId = created.body.rule.id as string;
        expect(created.body.scan.open).toBe(0);

        await client
            .patch(`/api/alarms/rules/${ruleId}`)
            .send({ filter: CONTAINS_QWERT })
            .expect(200);

        // No rescan call and no entry write in between: `update` rescans before
        // it answers, precisely so the findings table never describes the
        // previous condition.
        const findings = await client.get('/api/alarms/findings').expect(200);
        expect(findings.body.items).toHaveLength(1);
        expect(findings.body.items[0]).toMatchObject({
            ruleId,
            entryId: hit,
            title: 'Title Does not Match'
        });
    });

    it('stores the edited condition, so a later rescan still uses it', async () => {
        const client = await api();
        await publishArticle(client, { text: 'Has QWERT inside' });

        const created = await client
            .post('/api/alarms/rules')
            .send({
                contentType: 'test_article',
                name: 'Should Have',
                findingTitle: 'Title Does not Match',
                severity: 'error',
                filter: { and: [{ field: 'number', op: 'null', value: true }] }
            })
            .expect(201);
        const ruleId = created.body.rule.id as string;

        await client
            .patch(`/api/alarms/rules/${ruleId}`)
            .send({ filter: CONTAINS_QWERT })
            .expect(200);

        const rules = await client.get('/api/alarms/rules').expect(200);
        const stored = rules.body.find(
            (rule: { id: string }) => rule.id === ruleId
        );
        // Read back verbatim: the editor seeds its query builder from this, so
        // a filter the server rewrote on the way in would come back as a
        // different condition than the one that was saved.
        // covers: alarms:I-02
        expect(stored.filter).toEqual(CONTAINS_QWERT);
        expect(stored.brokenReason).toBeNull();

        const rescan = await client
            .post(`/api/alarms/rules/${ruleId}/rescan`)
            .expect(200);
        expect(rescan.body.open).toBe(1);
    });

    it('closes the findings the previous condition opened', async () => {
        const client = await api();
        await publishArticle(client, { text: 'Has QWERT inside' });

        const created = await client
            .post('/api/alarms/rules')
            .send({
                contentType: 'test_article',
                name: 'Should Have',
                findingTitle: 'Title Does not Match',
                severity: 'error',
                filter: CONTAINS_QWERT
            })
            .expect(201);
        const ruleId = created.body.rule.id as string;
        expect(created.body.scan.open).toBe(1);

        await client
            .patch(`/api/alarms/rules/${ruleId}`)
            .send({
                filter: {
                    and: [
                        { field: 'text', op: 'ilike', value: '%NOTHINGHERE%' }
                    ]
                }
            })
            .expect(200);

        const findings = await client.get('/api/alarms/findings').expect(200);
        expect(findings.body.items).toHaveLength(0);
    });
});
