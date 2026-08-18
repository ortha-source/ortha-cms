import { randomUUID } from 'node:crypto';
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
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'public-bulk-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** The asserted bits of a public entry. */
interface PublicItem {
    id: string;
    status?: string;
    locale?: string;
    localeGroupId?: string;
    values: Record<string, unknown>;
}

/** One item's verdict in a bulk save. */
interface BulkSaveItem {
    index: number;
    op: 'create' | 'update';
    ok: boolean;
    entry?: PublicItem;
    error?: { status: number; message: string; issues?: unknown };
}

/** The bulk-save response. */
interface BulkSaveResult {
    items: BulkSaveItem[];
    created: number;
    updated: number;
    failed: number;
}

/**
 * `POST /api/v1/content/:typeName/bulk…` — the **batch** writes of the public,
 * token-authenticated content API.
 *
 * Its own suite rather than more cases in `public-content-writes.spec.ts`,
 * because the thing under test is not "does a write work" — that is settled
 * there — but the two contracts a batch adds: **which routes the router
 * matches** (a literal `bulk` sitting where a uuid is expected), and **what
 * happens when only some of the batch succeeds**, which is the normal outcome
 * rather than an edge case.
 */
describe('Public content API — batches (/api/v1)', () => {
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
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
        await seedContentGrants(workspaceId, ['test_article', 'test_tag']);
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Mints a token through the real management API. Defaults to write scope. */
    async function mintToken(scope: 'read' | 'full' = 'full'): Promise<string> {
        const agent = await login();
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'e2e-bulk',
                workspaceIds: [workspaceId],
                scope
            })
            .expect(201);
        return res.body.secret as string;
    }

    /** A values bag that satisfies `test_article`'s publish-time requirements. */
    function publishable(text: string): Record<string, unknown> {
        return { text, select: 'article' };
    }

    /** Saves a batch and returns the result. */
    async function bulkSave(
        secret: string,
        items: Record<string, unknown>[]
    ): Promise<BulkSaveResult> {
        const res = await request(harness.server)
            .post('/api/v1/content/test_article/bulk')
            .set('Authorization', `Bearer ${secret}`)
            .send({ items })
            .expect(200);
        return res.body as BulkSaveResult;
    }

    /** Reads one entry back regardless of publish state. */
    async function read(secret: string, id: string): Promise<PublicItem> {
        const res = await request(harness.server)
            .get(`/api/v1/content/test_article/${id}`)
            .query({ status: 'any' })
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);
        return res.body as PublicItem;
    }

    describe('scope', () => {
        it('refuses every batch route to a read-only token', async () => {
            const readOnly = await mintToken('read');

            for (const path of [
                '/api/v1/content/test_article/bulk',
                '/api/v1/content/test_article/bulk/publish',
                '/api/v1/content/test_article/bulk/unpublish',
                '/api/v1/content/test_article/bulk/delete'
            ]) {
                await request(harness.server)
                    .post(path)
                    .set('Authorization', `Bearer ${readOnly}`)
                    .send({ items: [{ values: {} }], ids: [randomUUID()] })
                    .expect(403);
            }
        });

        it('404s a type the workspace was not granted', async () => {
            const secret = await mintToken();

            await request(harness.server)
                .post('/api/v1/content/test_page/bulk')
                .set('Authorization', `Bearer ${secret}`)
                .send({ items: [{ values: { text: 'Nope' } }] })
                .expect(404);
        });
    });

    describe('save', () => {
        it('creates and updates in one call, reporting each item', async () => {
            const secret = await mintToken();
            const seeded = await bulkSave(secret, [
                { values: publishable('First') }
            ]);
            const existing = seeded.items[0].entry as PublicItem;

            const result = await bulkSave(secret, [
                { values: publishable('Second') },
                { id: existing.id, values: { text: 'First, edited' } }
            ]);

            expect(result).toMatchObject({ created: 1, updated: 1, failed: 0 });
            expect(result.items.map((item) => item.op)).toEqual([
                'create',
                'update'
            ]);
            expect((await read(secret, existing.id)).values['text']).toBe(
                'First, edited'
            );
        });

        // The route sits where `:id` does, and `:id` carries a ParseUUIDPipe —
        // so a mis-ordered declaration would answer this with a 400 about a
        // malformed uuid rather than saving anything.
        it('matches `bulk` as a route, not as an entry id', async () => {
            const secret = await mintToken();

            const result = await bulkSave(secret, [
                { values: publishable('Routed') }
            ]);

            expect(result.created).toBe(1);
        });

        // An update merges, exactly as the single-entry PATCH does: a client
        // sends the fields it changed and the rest survive.
        it('merges an update instead of replacing the values bag', async () => {
            const secret = await mintToken();
            const created = (
                await bulkSave(secret, [{ values: publishable('Keep me') }])
            ).items[0].entry as PublicItem;

            await bulkSave(secret, [
                { id: created.id, values: { select: 'tutorial' } }
            ]);

            const after = await read(secret, created.id);
            expect(after.values['text']).toBe('Keep me');
            expect(after.values['select']).toBe('tutorial');
        });

        it('saves the good items and reports only the bad one', async () => {
            const secret = await mintToken();

            const result = await bulkSave(secret, [
                { values: publishable('Fine') },
                { id: randomUUID(), values: { text: 'Ghost' } },
                { values: publishable('Also fine') }
            ]);

            expect(result).toMatchObject({ created: 2, updated: 0, failed: 1 });
            expect(result.items[1]).toMatchObject({
                index: 1,
                ok: false,
                error: { status: 404 }
            });
            // The items either side of the failure really landed.
            expect(result.items[0].entry?.id).toBeDefined();
            expect(result.items[2].entry?.id).toBeDefined();
        });

        // Ambiguous addressing is that item's problem, not the request's.
        it('fails only the item that names a bare translation group', async () => {
            const secret = await mintToken();

            const result = await bulkSave(secret, [
                { values: publishable('Fine') },
                { localeGroupId: randomUUID(), values: publishable('Which?') }
            ]);

            expect(result).toMatchObject({ created: 1, failed: 1 });
            expect(result.items[1].error?.status).toBe(400);
        });

        it('adds a translation when the item says `op: "create"`', async () => {
            const secret = await mintToken();
            const en = (
                await bulkSave(secret, [{ values: publishable('English') }])
            ).items[0].entry as PublicItem;

            const result = await bulkSave(secret, [
                {
                    op: 'create',
                    locale: 'de',
                    localeGroupId: en.localeGroupId,
                    values: publishable('Deutsch')
                }
            ]);

            expect(result.created).toBe(1);
            const de = result.items[0].entry as PublicItem;
            expect(de.localeGroupId).toBe(en.localeGroupId);
            expect(de.locale).toBe('de');
            expect(de.id).not.toBe(en.id);
        });

        it('400s an empty batch and one over the cap', async () => {
            const secret = await mintToken();
            const oversized = Array.from({ length: 51 }, () => ({
                values: publishable('Too many')
            }));

            for (const items of [[], oversized]) {
                await request(harness.server)
                    .post('/api/v1/content/test_article/bulk')
                    .set('Authorization', `Bearer ${secret}`)
                    .send({ items })
                    .expect(400);
            }
        });
    });

    describe('publish', () => {
        it('publishes the valid drafts and says why it skipped the rest', async () => {
            const secret = await mintToken();
            const saved = await bulkSave(secret, [
                { values: publishable('Ready') },
                // No `select`, which `test_article` requires to publish.
                { values: { text: 'Incomplete' } }
            ]);
            const [ready, incomplete] = saved.items.map(
                (item) => (item.entry as PublicItem).id
            );
            const missing = randomUUID();

            const res = await request(harness.server)
                .post('/api/v1/content/test_article/bulk/publish')
                .set('Authorization', `Bearer ${secret}`)
                .send({ ids: [ready, incomplete, missing] })
                .expect(200);

            expect(res.body.published).toEqual([ready]);
            expect(res.body.skipped).toEqual(
                expect.arrayContaining([
                    { id: incomplete, reason: 'blocked' },
                    { id: missing, reason: 'not-found' }
                ])
            );
            expect((await read(secret, ready)).status).toBe('published');
        });

        it('counts only the entries an unpublish actually changed', async () => {
            const secret = await mintToken();
            const saved = await bulkSave(secret, [
                { values: publishable('Live') },
                { values: publishable('Still a draft') }
            ]);
            const [live, draft] = saved.items.map(
                (item) => (item.entry as PublicItem).id
            );
            await request(harness.server)
                .post('/api/v1/content/test_article/bulk/publish')
                .set('Authorization', `Bearer ${secret}`)
                .send({ ids: [live] })
                .expect(200);

            const res = await request(harness.server)
                .post('/api/v1/content/test_article/bulk/unpublish')
                .set('Authorization', `Bearer ${secret}`)
                .send({ ids: [live, draft, randomUUID()] })
                .expect(200);

            expect(res.body).toEqual({ count: 1 });
            expect((await read(secret, live)).status).toBe('draft');
        });
    });

    describe('delete', () => {
        it('removes the listed entries and counts them', async () => {
            const secret = await mintToken();
            const saved = await bulkSave(secret, [
                { values: publishable('Doomed') },
                { values: publishable('Also doomed') },
                { values: publishable('Survivor') }
            ]);
            const ids = saved.items.map(
                (item) => (item.entry as PublicItem).id
            );

            const res = await request(harness.server)
                .post('/api/v1/content/test_article/bulk/delete')
                .set('Authorization', `Bearer ${secret}`)
                .send({ ids: [ids[0], ids[1]] })
                .expect(200);

            expect(res.body).toEqual({ count: 2 });
            await request(harness.server)
                .get(`/api/v1/content/test_article/${ids[0]}`)
                .query({ status: 'any' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
            // The one that was not listed is untouched.
            expect((await read(secret, ids[2])).id).toBe(ids[2]);
        });
    });
});
