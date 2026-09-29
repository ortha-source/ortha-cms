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
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'required-relation-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** The asserted bits of a 422 body. */
interface Issue {
    field: string;
    message: string;
}

/**
 * `content:I-50` — a required relation whose target type the workspace was
 * **not granted** is not required in that workspace.
 *
 * `test_review` has two required relations, one per storage kind: `seo` (a
 * single FK column → `test_seo`) and `tags` (a join-table many-to-many →
 * `test_tag`). The workspace under test is granted `test_review` alone, which
 * is the reported case: the admin hides both fields, so an entry has to be
 * creatable, editable and publishable without them. Granting the targets puts
 * the requirement back, exactly as before.
 */
describe('Required relations to an ungranted type [content:I-50]', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'Reviews', slug: 'rev' }))
            .id;
        await seedMembership(admin.id, workspaceId);
        await seedContentGrants(workspaceId, ['test_review']);
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

    async function createReview(
        agent: request.Agent,
        values: Record<string, unknown> = { title: 'A review' }
    ): Promise<string> {
        const res = await agent
            .post('/api/content/test_review')
            .send({ values })
            .expect(201);
        return res.body.id as string;
    }

    function fieldsOf(body: { issues?: Issue[] }): string[] {
        return (body.issues ?? []).map((issue) => issue.field).sort();
    }

    describe('target types not granted', () => {
        it('creates, updates and publishes without either required relation', async () => {
            const agent = await login();
            const id = await createReview(agent);

            await agent
                .patch(`/api/content/test_review/${id}`)
                .send({ values: { title: 'Edited review' } })
                .expect(200);

            const published = await agent
                .post(`/api/content/test_review/${id}/publish`)
                .expect(201);
            expect(published.body).toMatchObject({
                id,
                status: 'published',
                values: { title: 'Edited review', seo: null }
            });
        });

        it('still enforces the rest of the gate', async () => {
            const agent = await login();
            const id = await createReview(agent, {});

            const res = await agent
                .post(`/api/content/test_review/${id}/publish`)
                .expect(422);
            expect(res.body.issues).toEqual([
                { field: 'title', message: 'is required' }
            ]);
        });

        it('still checks a value supplied for a waived field', async () => {
            const agent = await login();

            // The waiver removes `is required` and nothing else: a value that
            // is sent anyway meets the relation-target check as before.
            const res = await agent
                .post('/api/content/test_review')
                .send({ values: { title: 'A review', seo: 'not-a-uuid' } })
                .expect(422);
            expect(fieldsOf(res.body)).toEqual(['seo']);
        });

        it('bulk-publishes, and the dry run neither blocks on nor lists the waived fields', async () => {
            const agent = await login();
            const ids = [await createReview(agent), await createReview(agent)];

            const preview = await agent
                .post('/api/content/test_review/bulk/publish/preview')
                .send({ ids })
                .expect(200);
            for (const item of preview.body.items as {
                verdict: string;
                checks: { field: string }[];
            }[]) {
                expect(item.verdict).toBe('publishable');
                expect(item.checks.map((check) => check.field)).toEqual([
                    'title'
                ]);
            }

            const publish = await agent
                .post('/api/content/test_review/bulk/publish')
                .send({ ids })
                .expect(200);
            expect([...publish.body.published].sort()).toEqual([...ids].sort());
            expect(publish.body.skipped).toHaveLength(0);
        });

        it('publishes through the public API too', async () => {
            const agent = await login();
            const token = await agent
                .post('/api/api-tokens')
                .send({
                    name: 'reviews',
                    workspaceIds: [workspaceId],
                    scope: 'full'
                })
                .expect(201);
            const bearer = `Bearer ${token.body.secret as string}`;

            const created = await request(harness.server)
                .post('/api/v1/content/test_review')
                .set('Authorization', bearer)
                .send({ values: { title: 'Via token' } })
                .expect(201);
            const published = await request(harness.server)
                .post(`/api/v1/content/test_review/${created.body.id}/publish`)
                .set('Authorization', bearer)
                .expect(201);
            expect(published.body.status).toBe('published');
        });
    });

    describe('target types granted', () => {
        it('requires the single relation again, values first', async () => {
            await seedContentGrants(workspaceId, ['test_seo', 'test_tag']);
            const agent = await login();
            const id = await createReview(agent);

            const res = await agent
                .post(`/api/content/test_review/${id}/publish`)
                .expect(422);
            // Relations are not counted while the values are invalid, so only
            // the FK field is named — the pre-existing ordering.
            expect(res.body.issues).toEqual([
                { field: 'seo', message: 'is required' }
            ]);
        });

        it('requires the link-managed relation again once the values pass', async () => {
            await seedContentGrants(workspaceId, ['test_tag']);
            const agent = await login();
            const id = await createReview(agent);

            // `seo` stays waived (its target is still ungranted); `tags` is not.
            const blocked = await agent
                .post(`/api/content/test_review/${id}/publish`)
                .expect(422);
            expect(blocked.body.issues).toEqual([
                { field: 'tags', message: 'is required' }
            ]);

            const [tag] = await seedTags([{ name: 'Tag' }], workspaceId);
            await agent
                .patch(`/api/content/test_review/${id}`)
                .send({
                    values: { title: 'A review' },
                    relations: { tags: { link: [tag] } }
                })
                .expect(200);
            await agent
                .post(`/api/content/test_review/${id}/publish`)
                .expect(201);
        });

        it('blocks the bulk publish on it too', async () => {
            await seedContentGrants(workspaceId, ['test_seo', 'test_tag']);
            const agent = await login();
            const id = await createReview(agent);

            const preview = await agent
                .post('/api/content/test_review/bulk/publish/preview')
                .send({ ids: [id] })
                .expect(200);
            expect(preview.body.items[0].verdict).toBe('blocked');
            expect(fieldsOf(preview.body.items[0])).toEqual(['seo']);
        });
    });
});
