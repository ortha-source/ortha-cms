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
    seedArticles,
    seedContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'alarm-rules-admin@example.com';
const VIEWER_EMAIL = 'alarm-rules-viewer@example.com';
const PASSWORD = 'SecurePass123!';

/** The condition every fixture rule uses: a published article with no text. */
const EMPTY_TEXT_FILTER = {
    and: [
        { field: 'status', op: 'eq', value: 'published' },
        { field: 'text', op: 'null', value: true }
    ]
};

/**
 * ONE app per spec FILE — `closeTestApp` ends the shared pool, which Jest
 * scopes to the module registry.
 */
let harness: TestApp;

beforeAll(async () => {
    harness = await createTestApp();
});

afterAll(async () => {
    await closeTestApp(harness);
});

/**
 * `/api/alarms/rules` — the rule lifecycle.
 *
 * Three things here are only observable end-to-end, because each depends on
 * real SQL against a real schema:
 *
 * - **A new rule scans immediately.** The interesting case is content that
 *   already exists: a rule that only ever saw entries edited after it was
 *   written would report a clean collection on the day it is most likely to be
 *   wrong.
 * - **The filter is validated against the content type at write time.** A
 *   stored rule is replayed by a background subscriber for months; a tree that
 *   fails only at evaluation time fails where nobody is looking.
 * - **An ungranted content type is the same 404 as an unknown one**, so the
 *   rule editor cannot be used to enumerate the deployment's content model.
 */
describe('Alarm rules (/api/alarms/rules)', () => {
    let admin: SeededUser;
    let viewer: SeededUser;
    let workspaceId: string;

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        viewer = await seedActiveUser(harness.app, {
            email: VIEWER_EMAIL,
            password: PASSWORD,
            role: 'viewer'
        });
        const workspace = await seedWorkspace({
            name: 'Alarms',
            slug: 'alarms'
        });
        workspaceId = workspace.id;
        await seedMembership(admin.id, workspaceId);
        await seedMembership(viewer.id, workspaceId);
        await seedAllContentGrants(workspaceId);
    });

    /**
     * A logged-in agent carrying the workspace header every alarms route needs
     * (`WorkspaceGuard` reads it, and answers 400 without it).
     */
    async function login(email: string, workspace: string = workspaceId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace);
        return agent;
    }

    const asAdmin = () => login(ADMIN_EMAIL);

    const rulePayload = (overrides: Record<string, unknown> = {}) => ({
        contentType: 'test_article',
        name: 'Published with no body',
        findingTitle: 'This is published with an empty body',
        severity: 'warn',
        filter: EMPTY_TEXT_FILTER,
        ...overrides
    });

    describe('creation', () => {
        it('scans the existing collection, so the rule is right on day one', async () => {
            // Two published articles with no body, written BEFORE the rule
            // exists. No event will ever be raised about them again.
            await seedArticles(
                [
                    { text: null, status: 'published' },
                    { text: null, status: 'published' },
                    { text: 'has a body', status: 'published' }
                ],
                workspaceId
            );

            const api = await asAdmin();
            const res = await api
                .post('/api/alarms/rules')
                .send(rulePayload())
                .expect(201);

            expect(res.body.scan.open).toBe(2);
            expect(res.body.rule.openCount).toBe(2);
        });

        it('rejects a filter the content type cannot answer', async () => {
            const api = await asAdmin();
            await api
                .post('/api/alarms/rules')
                .send(
                    rulePayload({
                        filter: {
                            and: [{ field: 'nonesuch', op: 'eq', value: 'x' }]
                        }
                    })
                )
                .expect(400);
        });

        it('refuses a second rule with the same name in the workspace', async () => {
            const api = await asAdmin();
            await api.post('/api/alarms/rules').send(rulePayload()).expect(201);
            await api.post('/api/alarms/rules').send(rulePayload()).expect(409);
        });

        it('answers 404 for an ungranted type, exactly as for an unknown one', async () => {
            // Re-grant nothing but a single unrelated type, so `test_article`
            // is registered-but-ungranted.
            await resetDb();
            admin = await seedActiveUser(harness.app, {
                email: ADMIN_EMAIL,
                password: PASSWORD,
                role: 'admin'
            });
            const workspace = await seedWorkspace({
                name: 'Narrow',
                slug: 'narrow'
            });
            workspaceId = workspace.id;
            await seedMembership(admin.id, workspaceId);
            await seedContentGrants(workspaceId, ['test_author']);

            const api = await asAdmin();
            const ungranted = await api
                .post('/api/alarms/rules')
                .send(rulePayload())
                .expect(404);
            const unknown = await api
                .post('/api/alarms/rules')
                .send(rulePayload({ contentType: 'no_such_type' }))
                .expect(404);

            // Same status, and the same sentence with only the caller's own
            // argument substituted in. That is the property that matters:
            // nothing in either answer says whether the type exists, so the
            // rule editor cannot be used to enumerate the content model.
            expect(ungranted.body.message).toBe(
                'Unknown content type "test_article".'
            );
            expect(unknown.body.message).toBe(
                'Unknown content type "no_such_type".'
            );
        });
    });

    describe('preview', () => {
        it('reports matches against the collection total', async () => {
            await seedArticles(
                [
                    { text: null, status: 'published' },
                    { text: 'fine', status: 'published' },
                    { text: 'also fine', status: 'draft' }
                ],
                workspaceId
            );

            const api = await asAdmin();
            const res = await api
                .post('/api/alarms/rules/preview')
                .send({
                    contentType: 'test_article',
                    filter: EMPTY_TEXT_FILTER
                })
                .expect(200);

            expect(res.body).toMatchObject({ matched: 1, total: 3 });
        });
    });

    describe('update', () => {
        it('rescans when the filter changes, so findings never describe the old condition', async () => {
            await seedArticles(
                [
                    { text: null, status: 'published' },
                    { text: 'has a body', status: 'published' }
                ],
                workspaceId
            );

            const api = await asAdmin();
            const created = await api
                .post('/api/alarms/rules')
                .send(rulePayload())
                .expect(201);
            expect(created.body.rule.openCount).toBe(1);

            // Widen the condition to "every published article".
            const updated = await api
                .patch(`/api/alarms/rules/${created.body.rule.id}`)
                .send({
                    filter: {
                        and: [{ field: 'status', op: 'eq', value: 'published' }]
                    }
                })
                .expect(200);

            expect(updated.body.openCount).toBe(2);
        });
    });

    describe('deletion', () => {
        it('takes the rule and its findings with it', async () => {
            await seedArticles(
                [{ text: null, status: 'published' }],
                workspaceId
            );
            const api = await asAdmin();
            const created = await api
                .post('/api/alarms/rules')
                .send(rulePayload())
                .expect(201);

            await api
                .delete(`/api/alarms/rules/${created.body.rule.id}`)
                .expect(204);

            const findings = await api.get('/api/alarms/findings').expect(200);
            expect(findings.body.total).toBe(0);
        });
    });

    describe('authorization', () => {
        it('lets a viewer read rules but not write them', async () => {
            const api = await asAdmin();
            await api.post('/api/alarms/rules').send(rulePayload()).expect(201);

            const viewerAgent = await login(VIEWER_EMAIL);
            await viewerAgent
                .get('/api/alarms/rules')
                .set('X-Workspace-Id', workspaceId)
                .expect(200);
            await viewerAgent
                .post('/api/alarms/rules')
                .set('X-Workspace-Id', workspaceId)
                .send(rulePayload({ name: 'Another' }))
                .expect(403);
        });

        it('refuses a caller who is not a member of the workspace', async () => {
            const outsider = await seedActiveUser(harness.app, {
                email: 'outsider@example.com',
                password: PASSWORD,
                role: 'admin'
            });
            expect(outsider.id).toBeDefined();

            const agent = await login('outsider@example.com');
            await agent
                .get('/api/alarms/rules')
                .set('X-Workspace-Id', workspaceId)
                .expect(403);
        });
    });
});
