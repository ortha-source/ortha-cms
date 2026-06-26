import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';

const ADMIN_EMAIL = 'content-write-admin@example.com';
const CONTRIB_EMAIL = 'content-write-contrib@example.com';
const VIEWER_EMAIL = 'content-write-viewer@example.com';
const PASSWORD = 'SecurePass123!';

const VALID = { text: 'Hello world', select: 'article' } as const;

/**
 * The entry write API (`POST/PATCH/DELETE /api/content/:type…`, publish/restore,
 * and the bulk routes). Covers the create→read→update→publish→delete→restore→
 * purge lifecycle, the 422 validation shape, the publish-on-non-publishable 400,
 * the `/bulk/...` vs `:id` routing order, the trash list, and the permission
 * matrix (viewer read-only, contributor can't delete).
 */
describe('Content entry writes (/api/content/:type)', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    async function createArticle(
        agent: request.Agent,
        values: Record<string, unknown> = VALID
    ): Promise<string> {
        const res = await agent
            .post('/api/content/article')
            .send({ values })
            .expect(201);
        return res.body.id as string;
    }

    describe('create / read / update', () => {
        it('creates a draft, reads it back, and updates it', async () => {
            const agent = await login(ADMIN_EMAIL);

            const create = await agent
                .post('/api/content/article')
                .send({ values: VALID })
                .expect(201);
            expect(create.body).toMatchObject({
                status: 'draft',
                values: { text: 'Hello world', select: 'article' }
            });
            const id = create.body.id as string;

            const read = await agent
                .get(`/api/content/article/${id}`)
                .expect(200);
            expect(read.body.id).toBe(id);

            const update = await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: { ...VALID, text: 'Edited title' } })
                .expect(200);
            expect(update.body.values.text).toBe('Edited title');
        });

        it('saves an incomplete draft of a publishable type, but 422s on publish', async () => {
            const agent = await login(ADMIN_EMAIL);
            // A publishable type's draft may be incomplete — create doesn't validate.
            const create = await agent
                .post('/api/content/article')
                .send({ values: { text: 'ab' } })
                .expect(201);
            expect(create.body.status).toBe('draft');

            // Publishing re-validates the stored row and reports per-field issues.
            const res = await agent
                .post(`/api/content/article/${create.body.id}/publish`)
                .expect(422);
            const fields = (res.body.issues as { field: string }[]).map(
                (issue) => issue.field
            );
            // `text` too short and required `select` missing.
            expect(fields).toEqual(expect.arrayContaining(['text', 'select']));
        });

        it('allows editing a draft to an incomplete state, but not a published row', async () => {
            const agent = await login(ADMIN_EMAIL);

            // A draft may be edited to an incomplete (invalid) state.
            const draftId = await createArticle(agent);
            await agent
                .patch(`/api/content/article/${draftId}`)
                .send({ values: { text: '' } })
                .expect(200);

            // A published row must stay valid — clearing a required field 422s.
            const publishedId = await createArticle(agent);
            await agent
                .post(`/api/content/article/${publishedId}/publish`)
                .expect(201);
            await agent
                .patch(`/api/content/article/${publishedId}`)
                .send({ values: { text: '', select: 'article' } })
                .expect(422);
        });

        it('422s an invalid create of a non-publishable (always-live) type', async () => {
            const agent = await login(ADMIN_EMAIL);
            // `landing` is a single, not publishable → its writes validate now.
            const res = await agent
                .post('/api/content/landing')
                .send({ values: { text: 'ab' } })
                .expect(422);
            expect(Array.isArray(res.body.issues)).toBe(true);
            expect(res.body.issues.length).toBeGreaterThan(0);
        });

        it('404s reading an unknown id', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/article/00000000-0000-4000-8000-000000000000')
                .expect(404);
        });
    });

    describe('publish / unpublish', () => {
        it('publishes then unpublishes a draft', async () => {
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);

            const published = await agent
                .post(`/api/content/article/${id}/publish`)
                .expect(201);
            expect(published.body.status).toBe('published');

            const reverted = await agent
                .post(`/api/content/article/${id}/unpublish`)
                .expect(201);
            expect(reverted.body.status).toBe('draft');
        });

        it('400s publishing a non-publishable type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post(
                    '/api/content/landing/00000000-0000-4000-8000-000000000000/publish'
                )
                .expect(400);
        });
    });

    describe('delete / restore / purge (paranoid)', () => {
        it('soft-deletes, hides from the list, lists in trash, restores, purges', async () => {
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);

            await agent.delete(`/api/content/article/${id}`).expect(204);

            // Gone from the default list…
            const live = await agent.get('/api/content/article').expect(200);
            expect(live.body.items.map((i: { id: string }) => i.id)).not.toContain(id);

            // …but present in the trash view.
            const trash = await agent
                .get('/api/content/article?deleted=only')
                .expect(200);
            expect(trash.body.items.map((i: { id: string }) => i.id)).toContain(id);

            // Reading a soft-deleted row 404s.
            await agent.get(`/api/content/article/${id}`).expect(404);

            // Restore brings it back to the live list.
            await agent
                .post(`/api/content/article/${id}/restore`)
                .expect(201);
            const relisted = await agent.get('/api/content/article').expect(200);
            expect(relisted.body.items.map((i: { id: string }) => i.id)).toContain(id);

            // Delete again, then purge permanently.
            await agent.delete(`/api/content/article/${id}`).expect(204);
            await agent
                .delete(`/api/content/article/${id}/permanent`)
                .expect(204);
            const trashAfter = await agent
                .get('/api/content/article?deleted=only')
                .expect(200);
            expect(
                trashAfter.body.items.map((i: { id: string }) => i.id)
            ).not.toContain(id);
        });
    });

    describe('bulk', () => {
        it('previews then publishes only the valid drafts (and hits the bulk route, not :id)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const ids = [
                await createArticle(agent),
                await createArticle(agent),
                await createArticle(agent)
            ];

            const preview = await agent
                .post('/api/content/article/bulk/publish/preview')
                .send({ ids })
                .expect(200);
            expect(preview.body.items).toHaveLength(3);
            expect(
                preview.body.items.every(
                    (item: { verdict: string }) =>
                        item.verdict === 'publishable'
                )
            ).toBe(true);

            // If `/bulk/publish` had matched `:id/publish`, the uuid pipe would
            // have 400'd the literal `bulk` — a 200 here proves the ordering.
            const publish = await agent
                .post('/api/content/article/bulk/publish')
                .send({ ids })
                .expect(200);
            expect(publish.body.published).toHaveLength(3);
            expect(publish.body.skipped).toHaveLength(0);
        });

        it('bulk soft-deletes a set of entries', async () => {
            const agent = await login(ADMIN_EMAIL);
            const ids = [
                await createArticle(agent),
                await createArticle(agent)
            ];
            const res = await agent
                .post('/api/content/article/bulk/delete')
                .send({ ids })
                .expect(200);
            expect(res.body.count).toBe(2);
        });
    });

    describe('authorization', () => {
        it('401s unauthenticated writes', async () => {
            await request(harness.server)
                .post('/api/content/article')
                .send({ values: VALID })
                .expect(401);
        });

        it('403s a viewer on create and delete', async () => {
            await seedActiveUser(harness.app, {
                email: VIEWER_EMAIL,
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = await login(VIEWER_EMAIL);
            await agent
                .post('/api/content/article')
                .send({ values: VALID })
                .expect(403);
            await agent
                .delete(
                    '/api/content/article/00000000-0000-4000-8000-000000000000'
                )
                .expect(403);
        });

        it('lets a contributor create but not delete', async () => {
            await seedActiveUser(harness.app, {
                email: CONTRIB_EMAIL,
                password: PASSWORD,
                role: 'contributor'
            });
            const agent = await login(CONTRIB_EMAIL);
            const id = await createArticle(agent);
            await agent.delete(`/api/content/article/${id}`).expect(403);
        });
    });
});
