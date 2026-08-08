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
    seedArticles,
    seedContentGrants,
    seedTags,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'public-writes-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** One byte-accurate 1×1 PNG, so an upload exercises the image path. */
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

/** The asserted bits of a public entry. */
interface PublicItem {
    id: string;
    status?: string;
    publishedAt?: string | null;
    locale?: string;
    localeGroupId?: string;
    values: Record<string, unknown>;
    relations?: Record<
        string,
        {
            items: { id: string; values: Record<string, unknown> }[];
            total: number;
        }
    >;
    media?: Record<
        string,
        { items: { id: string; url: string; name: string }[]; total: number }
    >;
}

/**
 * `/api/v1/...` — the **write half** of the public, token-authenticated content
 * API: create drafts, edit them, assign and unassign relations, add
 * translations, publish, delete, and upload media to attach.
 *
 * Split from `public-content-api.spec.ts` (which covers the reads) because the
 * two need different fixtures — nearly everything here mints a `full`-scope
 * token and most cases assert against a *draft*, which the read suite exists to
 * prove is invisible.
 */
describe('Public content API — writes (/api/v1)', () => {
    let harness: TestApp;
    let workspaceId: string;
    let otherWorkspaceId: string;

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
        otherWorkspaceId = (await seedWorkspace({ name: 'WS B', slug: 'ws-b' }))
            .id;
        await seedContentGrants(workspaceId, ['test_article', 'test_tag']);
        await seedContentGrants(otherWorkspaceId, ['test_article']);
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
    async function mintToken(options?: {
        workspaceIds?: string[];
        scope?: 'read' | 'full';
    }): Promise<string> {
        const agent = await login();
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'e2e-writes',
                workspaceIds: options?.workspaceIds ?? [workspaceId],
                scope: options?.scope ?? 'full'
            })
            .expect(201);
        return res.body.secret as string;
    }

    /** A values bag that satisfies `test_article`'s publish-time requirements. */
    function publishable(text: string): Record<string, unknown> {
        return { text, select: 'article' };
    }

    /** Creates one entry through the public API and returns it. */
    async function create(
        secret: string,
        body: Record<string, unknown>,
        type = 'test_article'
    ): Promise<PublicItem> {
        const res = await request(harness.server)
            .post(`/api/v1/content/${type}`)
            .set('Authorization', `Bearer ${secret}`)
            .send(body)
            .expect(201);
        return res.body as PublicItem;
    }

    describe('scope', () => {
        it('refuses every write to a read-only token', async () => {
            const entryId = await create(await mintToken(), {
                values: publishable('Existing')
            }).then((entry) => entry.id);
            const readOnly = await mintToken({ scope: 'read' });

            const writes: [string, () => request.Test][] = [
                [
                    'create',
                    () =>
                        request(harness.server)
                            .post('/api/v1/content/test_article')
                            .send({ values: publishable('Nope') })
                ],
                [
                    'update',
                    () =>
                        request(harness.server)
                            .patch(`/api/v1/content/test_article/${entryId}`)
                            .send({ values: { text: 'Nope' } })
                ],
                [
                    'publish',
                    () =>
                        request(harness.server).post(
                            `/api/v1/content/test_article/${entryId}/publish`
                        )
                ],
                [
                    'unpublish',
                    () =>
                        request(harness.server).post(
                            `/api/v1/content/test_article/${entryId}/unpublish`
                        )
                ],
                [
                    'delete',
                    () =>
                        request(harness.server).delete(
                            `/api/v1/content/test_article/${entryId}`
                        )
                ]
            ];
            for (const [, build] of writes) {
                await build()
                    .set('Authorization', `Bearer ${readOnly}`)
                    .expect(403);
            }
        });

        it('refuses a write into a workspace outside the token’s bucket', async () => {
            const secret = await mintToken({ workspaceIds: [workspaceId] });

            await request(harness.server)
                .post('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', otherWorkspaceId)
                .send({ values: publishable('Theirs') })
                .expect(403);
        });

        it('404s a type the workspace was not granted', async () => {
            const secret = await mintToken();

            await request(harness.server)
                .post('/api/v1/content/test_page')
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { title: 'Nope' } })
                .expect(404);
        });
    });

    describe('create', () => {
        it('creates a draft, invisible to a read-only token until published', async () => {
            const secret = await mintToken();
            const readOnly = await mintToken({ scope: 'read' });

            const entry = await create(secret, {
                values: publishable('Fresh draft')
            });
            // A create is never live: publish is its own call, so there is
            // always a reviewable state in between.
            expect(entry.status).toBe('draft');
            expect(entry.publishedAt).toBeNull();
            expect(entry.values['text']).toBe('Fresh draft');

            await request(harness.server)
                .get(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${readOnly}`)
                .expect(404);

            await request(harness.server)
                .post(`/api/v1/content/test_article/${entry.id}/publish`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(201);

            await request(harness.server)
                .get(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${readOnly}`)
                .expect(200);
        });

        it('lets a write-scoped token read its own draft back', async () => {
            const secret = await mintToken();
            const readOnly = await mintToken({ scope: 'read' });
            const entry = await create(secret, {
                values: publishable('Mine to see')
            });

            // Without this the write API would be write-only: a create returns
            // the record once and it is invisible forever after.
            for (const status of ['draft', 'any']) {
                const res = await request(harness.server)
                    .get(`/api/v1/content/test_article/${entry.id}`)
                    .query({ status })
                    .set('Authorization', `Bearer ${secret}`)
                    .expect(200);
                expect(res.body.id).toBe(entry.id);
            }

            // …and a read-only token may not, on either spelling.
            for (const status of ['draft', 'any']) {
                await request(harness.server)
                    .get('/api/v1/content/test_article')
                    .query({ status })
                    .set('Authorization', `Bearer ${readOnly}`)
                    .expect(403);
            }
        });

        it('defers value validation to publish on a publishable type', async () => {
            const secret = await mintToken();

            // A draft may be incomplete AND malformed — not just missing its
            // `required` fields but carrying an out-of-range select, a number
            // in a text field, an over-long string. That is the point of a
            // draft, and it surprises API clients who expect a create to
            // validate, so it is pinned rather than left to be discovered.
            const entry = await create(secret, {
                values: { text: 'Draft', select: 'not-a-valid-option' }
            });
            expect(entry.status).toBe('draft');

            // Publish is where the type's rules are enforced, with the failing
            // fields named.
            const res = await request(harness.server)
                .post(`/api/v1/content/test_article/${entry.id}/publish`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(422);
            expect(res.body.issues).toEqual([
                expect.objectContaining({ field: 'select' })
            ]);
        });

        it('422s a create on a NON-publishable type straight away', async () => {
            const secret = await mintToken();

            // `test_page` has no publish gate, so there is no later moment to
            // validate at — every row is immediately live and the rules have to
            // hold at create. The contrast with the case above is the whole
            // rule: validation runs at the point the content goes live.
            await seedContentGrants(workspaceId, ['test_page']);
            await request(harness.server)
                .post('/api/v1/content/test_page')
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { title: 123 } })
                .expect(422);
        });

        it('400s a malformed relation delta', async () => {
            const secret = await mintToken();

            await request(harness.server)
                .post('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .send({
                    values: publishable('Bad delta'),
                    relations: { tags: { link: 'not-an-array' } }
                })
                .expect(400);
        });
    });

    describe('update', () => {
        it('merges the submitted values instead of replacing the bag', async () => {
            const secret = await mintToken();
            const entry = await create(secret, {
                values: { ...publishable('Original'), richtext: '<p>body</p>' }
            });

            const res = await request(harness.server)
                .patch(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { text: 'Retitled' } })
                .expect(200);

            // The field the caller never mentioned must survive. Under the
            // admin's replace semantics it would be null here — and because
            // `required` only bites at publish time, that loss would stay
            // invisible until some later publish failed.
            expect(res.body.values['text']).toBe('Retitled');
            expect(res.body.values['richtext']).toBe('<p>body</p>');
        });

        it('still clears a field that is sent explicitly as null', async () => {
            const secret = await mintToken();
            const entry = await create(secret, {
                values: { ...publishable('Has richtext'), richtext: '<p>x</p>' }
            });

            const res = await request(harness.server)
                .patch(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { richtext: null } })
                .expect(200);

            // Merge is by key PRESENCE, so an explicit null is still a clear —
            // otherwise a merging PATCH would make emptying a field impossible.
            expect(res.body.values['richtext']).toBeNull();
            expect(res.body.values['text']).toBe('Has richtext');
        });

        it('moves a published entry back to draft, keeping publishedAt', async () => {
            const secret = await mintToken();
            const readOnly = await mintToken({ scope: 'read' });
            const entry = await create(secret, {
                values: publishable('Live one')
            });
            await request(harness.server)
                .post(`/api/v1/content/test_article/${entry.id}/publish`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(201);

            const res = await request(harness.server)
                .patch(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { text: 'Edited' } })
                .expect(200);

            // The admin's "Modified" state: live content with unpublished edits
            // on top. `status` alone would read as a never-published draft.
            expect(res.body.status).toBe('draft');
            expect(res.body.publishedAt).not.toBeNull();

            // …and the edit is not live until it is published again.
            const live = await request(harness.server)
                .get(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${readOnly}`)
                .expect(404);
            expect(live.body).toBeDefined();
        });

        it('404s an entry in another workspace', async () => {
            const [theirs] = await seedArticles(
                [{ text: 'Theirs', select: 'article', locale: 'en' }],
                otherWorkspaceId
            );
            const secret = await mintToken({ workspaceIds: [workspaceId] });

            await request(harness.server)
                .patch(`/api/v1/content/test_article/${theirs}`)
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { text: 'Mine now' } })
                .expect(404);
        });
    });

    describe('relations', () => {
        it('assigns and unassigns links without sending the whole set', async () => {
            const secret = await mintToken();
            const [tagA, tagB] = await seedTags(
                [
                    {
                        name: 'Alpha',
                        status: 'published',
                        publishedAt: new Date()
                    },
                    {
                        name: 'Beta',
                        status: 'published',
                        publishedAt: new Date()
                    }
                ],
                workspaceId
            );
            const entry = await create(secret, {
                values: publishable('With tags')
            });

            await request(harness.server)
                .patch(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${secret}`)
                .send({
                    values: {},
                    relations: { tags: { link: [tagA, tagB] } }
                })
                .expect(200);
            expect(await tagNames(secret, entry.id)).toEqual(['Alpha', 'Beta']);

            // A delta, not a replacement: unlinking one leaves the other alone
            // even though the request never mentions it.
            await request(harness.server)
                .patch(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: {}, relations: { tags: { unlink: [tagA] } } })
                .expect(200);
            expect(await tagNames(secret, entry.id)).toEqual(['Beta']);
        });

        it('422s a link to an entry outside the workspace', async () => {
            const secret = await mintToken();
            const [theirTag] = await seedTags(
                [{ name: 'Theirs' }],
                otherWorkspaceId
            );
            const entry = await create(secret, {
                values: publishable('Cross-link')
            });

            for (const target of [theirTag, randomUUID()]) {
                await request(harness.server)
                    .patch(`/api/v1/content/test_article/${entry.id}`)
                    .set('Authorization', `Bearer ${secret}`)
                    .send({
                        values: {},
                        relations: { tags: { link: [target] } }
                    })
                    .expect(422);
            }
        });

        /** The entry's linked tag names, in order. */
        async function tagNames(
            secret: string,
            entryId: string
        ): Promise<string[]> {
            const res = await request(harness.server)
                .get(`/api/v1/content/test_article/${entryId}`)
                .query({
                    status: 'any',
                    relations: 'preview',
                    relationFields: 'tags'
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            return ((res.body as PublicItem).relations?.['tags']?.items ?? [])
                .map((item) => item.values['name'] as string)
                .sort();
        }
    });

    describe('localization', () => {
        it('adds a translation to an existing record’s group', async () => {
            const secret = await mintToken();
            const en = await create(secret, {
                values: publishable('English')
            });

            const de = await create(secret, {
                locale: 'de',
                localeGroupId: en.localeGroupId,
                values: publishable('Deutsch')
            });

            // Same story, different language — which is the whole point of the
            // group: the client took `localeGroupId` off a read and posted it.
            expect(de.localeGroupId).toBe(en.localeGroupId);
            expect(de.locale).toBe('de');
            expect(de.id).not.toBe(en.id);
        });

        it('409s a locale the group already holds', async () => {
            const secret = await mintToken();
            const en = await create(secret, { values: publishable('English') });

            await request(harness.server)
                .post('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .send({
                    locale: 'en',
                    localeGroupId: en.localeGroupId,
                    values: publishable('English again')
                })
                .expect(409);
        });

        it('404s a translation group that does not exist', async () => {
            const secret = await mintToken();

            await request(harness.server)
                .post('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .send({
                    locale: 'de',
                    localeGroupId: randomUUID(),
                    values: publishable('Orphan')
                })
                .expect(404);
        });

        it('addresses a write at the group’s row for the requested locale', async () => {
            const secret = await mintToken();
            const en = await create(secret, { values: publishable('English') });
            const de = await create(secret, {
                locale: 'de',
                localeGroupId: en.localeGroupId,
                values: publishable('Deutsch')
            });

            const res = await request(harness.server)
                .patch(`/api/v1/content/test_article/group/${en.localeGroupId}`)
                .query({ locale: 'de' })
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { text: 'Neu' } })
                .expect(200);

            // The locale comes from the QUERY, not the body. It used to come
            // from `body.locale` — which is create-only, so a body that omitted
            // it silently retargeted the write at the default-locale row, and a
            // German update rewrote the English article.
            expect(res.body.id).toBe(de.id);
            expect(res.body.locale).toBe('de');

            const english = await request(harness.server)
                .get(`/api/v1/content/test_article/${en.id}`)
                .query({ status: 'any' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(english.body.values['text']).toBe('English');
        });

        it('deletes one translation, leaving the group’s others live', async () => {
            const secret = await mintToken();
            const en = await create(secret, { values: publishable('English') });
            const de = await create(secret, {
                locale: 'de',
                localeGroupId: en.localeGroupId,
                values: publishable('Deutsch')
            });

            await request(harness.server)
                .delete(
                    `/api/v1/content/test_article/group/${en.localeGroupId}`
                )
                .query({ locale: 'de' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(204);

            await request(harness.server)
                .get(`/api/v1/content/test_article/${de.id}`)
                .query({ status: 'any' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
            await request(harness.server)
                .get(`/api/v1/content/test_article/${en.id}`)
                .query({ status: 'any' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
        });
    });

    describe('publish', () => {
        it('unpublishes back to a draft', async () => {
            const secret = await mintToken();
            const readOnly = await mintToken({ scope: 'read' });
            const entry = await create(secret, { values: publishable('Live') });
            await request(harness.server)
                .post(`/api/v1/content/test_article/${entry.id}/publish`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(201);

            const res = await request(harness.server)
                .post(`/api/v1/content/test_article/${entry.id}/unpublish`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(201);
            expect(res.body.status).toBe('draft');

            await request(harness.server)
                .get(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${readOnly}`)
                .expect(404);
        });
    });

    describe('delete', () => {
        it('removes an entry from the public reads', async () => {
            const secret = await mintToken();
            const entry = await create(secret, {
                values: publishable('Doomed')
            });
            await request(harness.server)
                .post(`/api/v1/content/test_article/${entry.id}/publish`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(201);

            await request(harness.server)
                .delete(`/api/v1/content/test_article/${entry.id}`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(204);

            // `test_article` is paranoid, so this is a soft delete — invisible
            // here either way, including to the token that can see drafts.
            await request(harness.server)
                .get(`/api/v1/content/test_article/${entry.id}`)
                .query({ status: 'any' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('404s an entry in another workspace', async () => {
            const [theirs] = await seedArticles(
                [{ text: 'Theirs', select: 'article', locale: 'en' }],
                otherWorkspaceId
            );
            const secret = await mintToken({ workspaceIds: [workspaceId] });

            await request(harness.server)
                .delete(`/api/v1/content/test_article/${theirs}`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });
    });

    describe('media', () => {
        it('uploads an asset, attaches it, and serves it back to the same token', async () => {
            const secret = await mintToken();

            const upload = await request(harness.server)
                .post('/api/v1/media/assets')
                .set('Authorization', `Bearer ${secret}`)
                .attach('file', PNG, {
                    filename: 'pixel.png',
                    contentType: 'image/png'
                })
                .expect(201);
            const assetId = upload.body.id as string;
            expect(upload.body.kind).toBe('image');

            const entry = await create(secret, {
                values: { ...publishable('With cover'), image: assetId }
            });

            const res = await request(harness.server)
                .get(`/api/v1/content/test_article/${entry.id}`)
                .query({
                    status: 'any',
                    media: 'preview',
                    mediaFields: 'image'
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            const view = (res.body as PublicItem).media?.['image'];
            expect(view?.items[0]?.id).toBe(assetId);

            // The URL the read hands back must be fetchable with the very token
            // that received it — the admin's own media route derives its scope
            // from membership, which a token has none of, so a bearer 404'd on
            // every URL this API returned before the `/v1` pair existed.
            expect(view?.items[0]?.url).toContain('/api/v1/media/assets/');
            const bytes = await request(harness.server)
                .get(view?.items[0]?.url ?? '')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(bytes.body).toEqual(PNG);
        });

        it('lets a read-only token fetch bytes but never upload', async () => {
            const writer = await mintToken();
            const readOnly = await mintToken({ scope: 'read' });
            const upload = await request(harness.server)
                .post('/api/v1/media/assets')
                .set('Authorization', `Bearer ${writer}`)
                .attach('file', PNG, {
                    filename: 'pixel.png',
                    contentType: 'image/png'
                })
                .expect(201);

            // A read-only consumer is exactly the one that wants to display the
            // image, so withholding the bytes would make the metadata useless.
            await request(harness.server)
                .get(`/api/v1/media/assets/${upload.body.id}/raw`)
                .set('Authorization', `Bearer ${readOnly}`)
                .expect(200);

            await request(harness.server)
                .post('/api/v1/media/assets')
                .set('Authorization', `Bearer ${readOnly}`)
                .attach('file', PNG, {
                    filename: 'nope.png',
                    contentType: 'image/png'
                })
                .expect(403);
        });

        it('404s an asset outside the request’s workspace', async () => {
            const secret = await mintToken({
                workspaceIds: [workspaceId, otherWorkspaceId]
            });
            const upload = await request(harness.server)
                .post('/api/v1/media/assets')
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', workspaceId)
                .attach('file', PNG, {
                    filename: 'pixel.png',
                    contentType: 'image/png'
                })
                .expect(201);

            // Even inside the token's own bucket: the request named a
            // workspace, and reading across that line would make the header
            // advisory rather than binding.
            await request(harness.server)
                .get(`/api/v1/media/assets/${upload.body.id}/raw`)
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', otherWorkspaceId)
                .expect(404);
        });

        it('422s a media id the workspace does not own', async () => {
            const secret = await mintToken();

            await request(harness.server)
                .post('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .send({
                    values: { ...publishable('Bad asset'), image: randomUUID() }
                })
                .expect(422);
        });

        it('400s an upload with no file part', async () => {
            const secret = await mintToken();

            await request(harness.server)
                .post('/api/v1/media/assets')
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });
    });
});
