import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';
import { reloadSegmentCatalogue } from '../../support/segments';

const ADMIN = 'segments-admin@example.com';
const VIEWER = 'segments-viewer@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The audience directory (`/api/segments`).
 *
 * The vocabulary half of the feature: create, list, page, look up by id, rename,
 * rescope, delete. Everything about *what an audience may read* happens on the
 * entry and lives in `entry-access.spec.ts`.
 */
describe('Segments directory (/api/segments)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let viewer: SeededUser;
    let workspaceA: string;
    let workspaceB: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        // The catalogue is in-memory and the truncate went behind its back.
        await reloadSegmentCatalogue(harness.app);
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        viewer = await seedActiveUser(harness.app, {
            email: VIEWER,
            password: PASSWORD,
            role: 'viewer'
        });
        workspaceA = (await seedWorkspace({ name: 'A', slug: 'ws-a' })).id;
        workspaceB = (await seedWorkspace({ name: 'B', slug: 'ws-b' })).id;
        await seedMembership(admin.id, workspaceA);
        await seedMembership(admin.id, workspaceB);
        await seedMembership(viewer.id, workspaceA);
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Create one audience, returning its id. */
    async function create(
        agent: request.Agent,
        body: Record<string, unknown>
    ): Promise<string> {
        const response = await agent
            .post('/api/segments')
            .send(body)
            .expect(201);
        return response.body.id as string;
    }

    describe('create', () => {
        it('defaults the reader tags to the key', async () => {
            // A segment with no tags matches nobody, which is a segment that can
            // only ever close content.
            const agent = await login(ADMIN);
            const response = await agent
                .post('/api/segments')
                .send({ key: 'acme', label: 'Acme Corp' })
                .expect(201);

            expect(Object.keys(response.body).sort()).toEqual([
                'id',
                'key',
                'label',
                'tags',
                'usageCount',
                'workspaceIds'
            ]);
            expect(response.body).toMatchObject({
                key: 'acme',
                label: 'Acme Corp',
                tags: ['acme'],
                workspaceIds: [],
                usageCount: 0
            });
        });

        it('keeps the tags it was given', async () => {
            const agent = await login(ADMIN);
            const response = await agent
                .post('/api/segments')
                .send({
                    key: 'acme',
                    label: 'Acme',
                    tags: ['acme', 'acme-legacy']
                })
                .expect(201);

            expect(response.body.tags).toEqual(['acme', 'acme-legacy']);
        });

        it('refuses a duplicate key with 409', async () => {
            const agent = await login(ADMIN);
            await create(agent, { key: 'acme', label: 'Acme' });

            await agent
                .post('/api/segments')
                .send({ key: 'acme', label: 'Acme again' })
                .expect(409);
        });

        it('refuses a malformed key', async () => {
            // The key is also the default reader tag, so a space or a capital
            // would become a tag nobody's resolver produces.
            const agent = await login(ADMIN);
            for (const key of ['Acme Corp', 'ACME', '-acme']) {
                await agent
                    .post('/api/segments')
                    .send({ key, label: 'Acme' })
                    .expect(400);
            }
        });

        it('refuses an unknown body key', async () => {
            const agent = await login(ADMIN);
            await agent
                .post('/api/segments')
                .send({ key: 'acme', label: 'Acme', colour: 'red' })
                .expect(400);
        });

        it('refuses a disallowed Origin', async () => {
            const agent = await login(ADMIN);
            await agent
                .post('/api/segments')
                .set('Origin', 'https://evil.example')
                .send({ key: 'acme', label: 'Acme' })
                .expect(403);
        });
    });

    describe('permissions', () => {
        it('lets a viewer read the directory', async () => {
            // `segments:read` is held by contributor and viewer: an editor who
            // cannot see that an entry is restricted will publish one believing
            // it is public.
            const agent = await login(VIEWER);
            await agent.get('/api/segments').expect(200);
        });

        it('refuses a viewer the write routes', async () => {
            const asAdmin = await login(ADMIN);
            const id = await create(asAdmin, { key: 'acme', label: 'Acme' });

            const agent = await login(VIEWER);
            await agent
                .post('/api/segments')
                .send({ key: 'other', label: 'Other' })
                .expect(403);
            await agent
                .patch(`/api/segments/${id}`)
                .send({ label: 'Renamed' })
                .expect(403);
            await agent.delete(`/api/segments/${id}`).expect(403);
        });

        it('refuses an unauthenticated caller', async () => {
            await request(harness.server).get('/api/segments').expect(401);
        });
    });

    describe('list', () => {
        it('pages, and carries every matched id alongside the page', async () => {
            // `ids` is what the entry editor's "set every audience to…" acts
            // on, so it must be every match rather than this page's — a bulk
            // action that set three of five would be invisible until a reader
            // was turned away.
            const agent = await login(ADMIN);
            for (const n of [1, 2, 3, 4, 5]) {
                await create(agent, { key: `seg-${n}`, label: `Seg ${n}` });
            }

            const page = await agent
                .get('/api/segments')
                .query({ page: 2, pageSize: 2 })
                .expect(200);

            expect(page.body.total).toBe(5);
            expect(page.body.page).toBe(2);
            expect(page.body.items).toHaveLength(2);
            expect(page.body.ids).toHaveLength(5);
            expect(page.body.idsTruncated).toBe(false);
            // Ordered by label, so page 2 of 2-per-page is the third and fourth.
            expect(page.body.items.map((s: { key: string }) => s.key)).toEqual([
                'seg-3',
                'seg-4'
            ]);
        });

        it('narrows by a search term, over the label and the key', async () => {
            const agent = await login(ADMIN);
            await create(agent, { key: 'acme', label: 'Acme Corp' });
            await create(agent, { key: 'globex', label: 'Globex' });

            const byLabel = await agent
                .get('/api/segments')
                .query({ q: 'corp' })
                .expect(200);
            expect(byLabel.body.total).toBe(1);

            const byKey = await agent
                .get('/api/segments')
                .query({ q: 'globe' })
                .expect(200);
            expect(byKey.body.total).toBe(1);

            // The search is matched literally — a metacharacter is a needle,
            // not a pattern.
            const wildcard = await agent
                .get('/api/segments')
                .query({ q: '%' })
                .expect(200);
            expect(wildcard.body.total).toBe(0);
        });

        it('offers an unscoped audience in every workspace', async () => {
            // Empty means every one — the same reading as an entry's empty
            // allow list, and the state every segment starts in.
            const agent = await login(ADMIN);
            await create(agent, { key: 'acme', label: 'Acme' });

            for (const workspace of [workspaceA, workspaceB]) {
                const response = await agent
                    .get('/api/segments')
                    .query({ workspace })
                    .expect(200);
                expect(response.body.total).toBe(1);
            }
        });

        it('offers a scoped audience only where it is named', async () => {
            const agent = await login(ADMIN);
            await create(agent, {
                key: 'acme',
                label: 'Acme',
                workspaceIds: [workspaceA]
            });

            const inA = await agent
                .get('/api/segments')
                .query({ workspace: workspaceA })
                .expect(200);
            expect(inA.body.total).toBe(1);

            const inB = await agent
                .get('/api/segments')
                .query({ workspace: workspaceB })
                .expect(200);
            expect(inB.body.total).toBe(0);

            // The unscoped directory still shows it: that page manages the
            // installation's whole vocabulary.
            const all = await agent.get('/api/segments').expect(200);
            expect(all.body.total).toBe(1);
        });
    });

    describe('lookup', () => {
        it('resolves ids whatever page they would fall on', async () => {
            // The reason the route exists: a caller holding ids (the entry
            // header chip, a revision's captured access) cannot count on the
            // first page containing them.
            const agent = await login(ADMIN);
            const ids: string[] = [];
            for (const n of [1, 2, 3]) {
                ids.push(
                    await create(agent, { key: `s${n}`, label: `S ${n}` })
                );
            }

            const response = await agent
                .get('/api/segments/lookup')
                .query({ ids: ids.join(',') })
                .expect(200);

            expect(
                response.body.map((s: { id: string }) => s.id).sort()
            ).toEqual([...ids].sort());
        });

        it('accepts a single id, not only a list', async () => {
            // `?ids=a` parses as a string and `?ids=a&ids=b` as an array, so a
            // one-id lookup would fail the array check without the transform.
            const agent = await login(ADMIN);
            const id = await create(agent, { key: 'acme', label: 'Acme' });

            const response = await agent
                .get('/api/segments/lookup')
                .query({ ids: id })
                .expect(200);
            expect(response.body).toHaveLength(1);
        });

        it('skips an unknown id rather than refusing the request', async () => {
            // A segment a revision captured really can have been deleted since,
            // and that is a state the caller renders, not an error.
            const agent = await login(ADMIN);
            const id = await create(agent, { key: 'acme', label: 'Acme' });

            const response = await agent
                .get('/api/segments/lookup')
                .query({
                    ids: `${id},11111111-1111-4111-8111-111111111111`
                })
                .expect(200);
            expect(response.body).toHaveLength(1);
        });

        it('is matched before `:id`', async () => {
            // Declaration order is what keeps the literal segment winning.
            const agent = await login(ADMIN);
            await agent
                .get('/api/segments/lookup')
                .query({ ids: '' })
                .expect(200);
        });
    });

    describe('read one', () => {
        it('returns the segment', async () => {
            const agent = await login(ADMIN);
            const id = await create(agent, { key: 'acme', label: 'Acme' });

            const response = await agent.get(`/api/segments/${id}`).expect(200);
            expect(response.body).toMatchObject({ id, key: 'acme' });
        });

        it('404s an unknown id', async () => {
            const agent = await login(ADMIN);
            await agent
                .get('/api/segments/11111111-1111-4111-8111-111111111111')
                .expect(404);
        });
    });

    describe('update', () => {
        it('renames, retags and rescopes', async () => {
            const agent = await login(ADMIN);
            const id = await create(agent, { key: 'acme', label: 'Acme' });

            const response = await agent
                .patch(`/api/segments/${id}`)
                .send({
                    label: 'Acme Corp',
                    tags: ['acme', 'acme-legacy'],
                    workspaceIds: [workspaceA]
                })
                .expect(200);

            expect(response.body).toMatchObject({
                // The key is immutable, and unchanged by a body that omits it.
                key: 'acme',
                label: 'Acme Corp',
                tags: ['acme', 'acme-legacy'],
                workspaceIds: [workspaceA]
            });
        });

        it('leaves an omitted field alone', async () => {
            const agent = await login(ADMIN);
            const id = await create(agent, {
                key: 'acme',
                label: 'Acme',
                tags: ['acme', 'legacy'],
                workspaceIds: [workspaceA]
            });

            const response = await agent
                .patch(`/api/segments/${id}`)
                .send({ label: 'Renamed' })
                .expect(200);

            expect(response.body.tags).toEqual(['acme', 'legacy']);
            expect(response.body.workspaceIds).toEqual([workspaceA]);
        });
    });

    describe('delete', () => {
        it('removes it, and 404s afterwards', async () => {
            const agent = await login(ADMIN);
            const id = await create(agent, { key: 'acme', label: 'Acme' });

            await agent.delete(`/api/segments/${id}`).expect(204);
            await agent.get(`/api/segments/${id}`).expect(404);
        });
    });
});
