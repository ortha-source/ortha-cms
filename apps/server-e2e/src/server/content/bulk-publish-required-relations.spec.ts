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
    seedTags,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'bulk-required-admin@example.com';
const PASSWORD = 'SecurePass123!';
const TYPE = 'test_review';

/** One bulk-publish dry-run row, as far as these assertions care. */
interface PreviewItem {
    id: string;
    verdict: string;
    issues: { field: string; message: string }[];
    checks: { field: string; ok: boolean; message?: string }[];
}

/**
 * `content:I-51` — bulk publish and its dry run apply the single publish's
 * **whole** gate, including the required **link-managed** relations (an owning
 * many-to-many, or the inverse of one) whose links never travel in the
 * `values` bag. They used to apply only the value rules, so a batch published
 * the draft that `POST …/:id/publish` refused with a 422.
 *
 * `test_review.tags` is a required join-table many-to-many to `test_tag`. The
 * workspace is granted `test_review` and `test_tag`, so `tags` is required;
 * `test_seo` stays ungranted so the FK relation `seo` is waived (**I-50**) and
 * a review with a title and a tag is otherwise complete.
 */
describe('Bulk publish counts required link-managed relations [content:I-51]', () => {
    let harness: TestApp;
    let workspaceId: string;
    let adminId: string;

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
        adminId = admin.id;
        workspaceId = (await seedWorkspace({ name: 'Reviews', slug: 'rev' }))
            .id;
        await seedMembership(admin.id, workspaceId);
        await seedContentGrants(workspaceId, [TYPE, 'test_tag']);
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

    /** A draft review, linked to `tags` when given. */
    async function createReview(
        agent: request.Agent,
        title: string,
        tags: string[] = []
    ): Promise<string> {
        const res = await agent
            .post(`/api/content/${TYPE}`)
            .send({
                values: { title },
                ...(tags.length ? { relations: { tags: { link: tags } } } : {})
            })
            .expect(201);
        return res.body.id as string;
    }

    /** One complete review and one missing its required tags. */
    async function seedPair(agent: request.Agent) {
        const [tag] = await seedTags([{ name: 'Tag' }], workspaceId);
        const complete = await createReview(agent, 'Complete', [tag]);
        const untagged = await createReview(agent, 'Untagged');
        return { complete, untagged };
    }

    async function statusOf(agent: request.Agent, id: string) {
        const res = await agent.get(`/api/content/${TYPE}/${id}`).expect(200);
        return res.body.status as string;
    }

    async function mintFullToken(agent: request.Agent): Promise<string> {
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'bulk-required',
                workspaceIds: [workspaceId],
                scope: 'full'
            })
            .expect(201);
        return res.body.secret as string;
    }

    it('refuses the entry the single publish refuses, with the same issue, and publishes the rest', async () => {
        const agent = await login();
        const { complete, untagged } = await seedPair(agent);

        const single = await agent
            .post(`/api/content/${TYPE}/${untagged}/publish`)
            .expect(422);
        expect(single.body.issues).toEqual([
            { field: 'tags', message: 'is required' }
        ]);

        const res = await agent
            .post(`/api/content/${TYPE}/bulk/publish`)
            .send({ ids: [complete, untagged] })
            .expect(200);
        expect(res.body).toEqual({
            published: [complete],
            skipped: [{ id: untagged, reason: 'blocked' }]
        });
        expect(await statusOf(agent, complete)).toBe('published');
        expect(await statusOf(agent, untagged)).toBe('draft');
    });

    it('lists it as blocked in the dry run, with the single publish’s issue', async () => {
        const agent = await login();
        const { complete, untagged } = await seedPair(agent);

        const res = await agent
            .post(`/api/content/${TYPE}/bulk/publish/preview`)
            .send({ ids: [complete, untagged] })
            .expect(200);
        const [ok, blocked] = res.body.items as PreviewItem[];

        expect(ok).toMatchObject({
            id: complete,
            verdict: 'publishable',
            issues: []
        });
        expect(ok.checks).toEqual([
            { field: 'title', label: 'Title', ok: true },
            { field: 'tags', label: 'Tags', ok: true }
        ]);

        expect(blocked).toMatchObject({ id: untagged, verdict: 'blocked' });
        expect(blocked.issues).toEqual([
            { field: 'tags', message: 'is required' }
        ]);
        expect(blocked.checks).toContainEqual({
            field: 'tags',
            label: 'Tags',
            ok: false,
            message: 'is required'
        });
    });

    it('waives it when the target type is not granted [content:I-50]', async () => {
        // A second workspace granted the review type alone: `tags` points at
        // a type it cannot reach, so nobody there could ever satisfy it.
        workspaceId = (await seedWorkspace({ name: 'Solo', slug: 'solo' })).id;
        await seedMembership(adminId, workspaceId);
        await seedContentGrants(workspaceId, [TYPE]);
        const agent = await login();
        const untagged = await createReview(agent, 'Untagged');

        const preview = await agent
            .post(`/api/content/${TYPE}/bulk/publish/preview`)
            .send({ ids: [untagged] })
            .expect(200);
        expect(preview.body.items[0]).toMatchObject({
            verdict: 'publishable',
            issues: []
        });

        const res = await agent
            .post(`/api/content/${TYPE}/bulk/publish`)
            .send({ ids: [untagged] })
            .expect(200);
        expect(res.body).toEqual({ published: [untagged], skipped: [] });
    });

    it('holds through the public API bulk publish', async () => {
        const agent = await login();
        const { complete, untagged } = await seedPair(agent);
        const secret = await mintFullToken(agent);

        const res = await request(harness.server)
            .post(`/api/v1/content/${TYPE}/bulk/publish`)
            .set('Authorization', `Bearer ${secret}`)
            .send({ ids: [complete, untagged] })
            .expect(200);
        expect(res.body).toEqual({
            published: [complete],
            skipped: [{ id: untagged, reason: 'blocked' }]
        });
        expect(await statusOf(agent, untagged)).toBe('draft');
    });

    it('holds through the MCP content_bulk_publish tool', async () => {
        const agent = await login();
        const { complete, untagged } = await seedPair(agent);
        const secret = await mintFullToken(agent);

        const res = await request(harness.server)
            .post('/api/v1/mcp')
            .set('Authorization', `Bearer ${secret}`)
            .set('Accept', 'application/json, text/event-stream')
            .set('Content-Type', 'application/json')
            .send({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'content_bulk_publish',
                    arguments: { typeName: TYPE, ids: [complete, untagged] }
                }
            })
            .expect(200);
        const result = res.body.result as {
            isError?: boolean;
            content: { text: string }[];
        };
        expect(result.isError).not.toBe(true);
        expect(JSON.parse(result.content[0].text)).toEqual({
            published: [complete],
            skipped: [{ id: untagged, reason: 'blocked' }]
        });
        expect(await statusOf(agent, untagged)).toBe('draft');
    });
});
