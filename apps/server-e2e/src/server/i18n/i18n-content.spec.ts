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

const ADMIN_EMAIL = 'i18n-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** A valid `article` payload (`text` localized + required `select`). */
const VALID = { text: 'Hello world', select: 'article' } as const;

/**
 * Content localization end to end. The host's reference `article` collection is
 * `i18n: true` (locales en [default] / de / fr), so these drive the real
 * pipeline: locale stamping on create, strict active-locale scoping with the
 * default fallback, translation creation (copy + 409 on duplicate),
 * shared-field sync across a group with published-sibling re-validation, the
 * hasLocale/missingLocale/localeCount filters, the per-entry locale panel, the
 * batched summary, and the non-i18n regression.
 */
describe('Content i18n (/api/content/:type + /api/i18n)', () => {
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
        const ws = await seedWorkspace({ name: 'WS One', slug: 'ws-one' });
        workspaceId = ws.id;
        await seedMembership(admin.id, workspaceId);
    });

    async function login(email = ADMIN_EMAIL) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    /** The shape of an article row as the create/read endpoints return it. */
    type ArticleRow = {
        id: string;
        locale: string;
        localeGroupId: string;
        status: string;
        values: Record<string, unknown>;
    };

    /** Create an article, optionally in a given locale; return the row. */
    async function createArticle(
        agent: request.Agent,
        body: Record<string, unknown> = {}
    ): Promise<ArticleRow> {
        const res = await agent
            .post('/api/content/article')
            .send({ values: VALID, ...body })
            .expect(201);
        return res.body as ArticleRow;
    }

    /**
     * Create a sibling translation of `source` via the **normal create**
     * endpoint (`POST /content` + `localeGroupId`) — copying the source's
     * values into the target locale within its group. Asserts `expectStatus`
     * (201 by default) and returns the response.
     */
    async function createTranslation(
        agent: request.Agent,
        source: ArticleRow,
        locale: string,
        expectStatus = 201
    ) {
        return agent
            .post('/api/content/article')
            .send({
                values: source.values,
                locale,
                localeGroupId: source.localeGroupId
            })
            .expect(expectStatus);
    }

    describe('locales endpoint', () => {
        it('serves the configured locales with exactly one default', async () => {
            const agent = await login();
            const res = await agent.get('/api/i18n/locales').expect(200);
            const slugs = (res.body.items as { slug: string }[]).map(
                (item) => item.slug
            );
            expect(slugs).toEqual(expect.arrayContaining(['en', 'de', 'fr']));
            const defaults = (
                res.body.items as { isDefault: boolean }[]
            ).filter((item) => item.isDefault);
            expect(defaults).toHaveLength(1);
        });
    });

    describe('create stamps the locale', () => {
        it('defaults to the default locale (en) when none is sent', async () => {
            const agent = await login();
            const row = await createArticle(agent);
            expect(row.locale).toBe('en');
            expect(row.localeGroupId).toBeTruthy();
        });

        it('stamps an explicit locale', async () => {
            const agent = await login();
            const row = await createArticle(agent, { locale: 'de' });
            expect(row.locale).toBe('de');
        });

        it('400s an unknown locale', async () => {
            const agent = await login();
            await agent
                .post('/api/content/article')
                .send({ values: VALID, locale: 'zz' })
                .expect(400);
        });

        it('gives a plain create its own fresh translation group', async () => {
            const agent = await login();
            const a = await createArticle(agent);
            const b = await createArticle(agent);
            expect(a.localeGroupId).not.toBe(b.localeGroupId);
        });
    });

    describe('strict list scoping + default fallback', () => {
        it('lists only the default locale when no ?locale= is sent', async () => {
            const agent = await login();
            await createArticle(agent); // en
            const de = await createArticle(agent, { locale: 'de' });
            const res = await agent.get('/api/content/article').expect(200);
            const ids = (res.body.items as { id: string }[]).map((i) => i.id);
            expect(ids).not.toContain(de.id);
            expect(
                (res.body.items as { locale: string }[]).every(
                    (i) => i.locale === 'en'
                )
            ).toBe(true);
        });

        it('lists only the requested locale with ?locale=de (strict)', async () => {
            const agent = await login();
            const en = await createArticle(agent);
            const de = await createArticle(agent, { locale: 'de' });
            const res = await agent
                .get('/api/content/article?locale=de')
                .expect(200);
            const ids = (res.body.items as { id: string }[]).map((i) => i.id);
            expect(ids).toContain(de.id);
            expect(ids).not.toContain(en.id);
        });

        it('400s a list scoped to an unknown locale', async () => {
            const agent = await login();
            await agent.get('/api/content/article?locale=zz').expect(400);
        });

        it('falls back to the default row where the requested locale is missing', async () => {
            const agent = await login();
            // An en-only group (no de translation).
            const en = await createArticle(agent);
            const res = await agent
                .get('/api/content/article?locale=de&localeFallback=default')
                .expect(200);
            const ids = (res.body.items as { id: string }[]).map((i) => i.id);
            // The en row stands in for the missing de translation.
            expect(ids).toContain(en.id);
        });
    });

    // Sibling translations are created through the normal create endpoint:
    // `POST /content` with a `localeGroupId` joins that group.
    describe('create translation (POST /content + localeGroupId)', () => {
        it('creates a new draft sibling sharing the group', async () => {
            const agent = await login();
            const en = await createArticle(agent, {
                values: { text: 'Winter boots', select: 'article' }
            });
            const res = await createTranslation(agent, en, 'de');
            expect(res.body.locale).toBe('de');
            expect(res.body.localeGroupId).toBe(en.localeGroupId);
            expect(res.body.status).toBe('draft');
            // The client carried the source's values into the new locale.
            expect(res.body.values.text).toBe('Winter boots');
        });

        it('409s a duplicate locale in the group', async () => {
            const agent = await login();
            const en = await createArticle(agent);
            await createTranslation(agent, en, 'de');
            await createTranslation(agent, en, 'de', 409);
        });

        it('400s a sibling in an unknown target locale', async () => {
            const agent = await login();
            const en = await createArticle(agent);
            await createTranslation(agent, en, 'zz', 400);
        });

        it('404s a localeGroupId that names no group in the workspace', async () => {
            const agent = await login();
            await agent
                .post('/api/content/article')
                .send({
                    values: VALID,
                    locale: 'de',
                    localeGroupId: '00000000-0000-4000-8000-000000000000'
                })
                .expect(404);
        });
    });

    describe('shared-field sync', () => {
        it('propagates a non-localized field to siblings but leaves localized fields alone', async () => {
            const agent = await login();
            const en = await createArticle(agent, {
                values: { text: 'EN title', select: 'article' }
            });
            const de = (await createTranslation(agent, en, 'de'))
                .body as { id: string };
            // Give the de row its own localized text.
            await agent
                .patch(`/api/content/article/${de.id}`)
                .send({ values: { text: 'DE title', select: 'article' } })
                .expect(200);

            // Edit a SHARED field (`number`) on the en row — it must sync to de.
            await agent
                .patch(`/api/content/article/${en.id}`)
                .send({
                    values: { text: 'EN title', select: 'article', number: 42 }
                })
                .expect(200);

            const deAfter = await agent
                .get(`/api/content/article/${de.id}`)
                .expect(200);
            // Shared field synced...
            expect(deAfter.body.values.number).toBe(42);
            // ...localized field untouched.
            expect(deAfter.body.values.text).toBe('DE title');
        });

        it('does not sync a relation to a localizable target across locales', async () => {
            const agent = await login();
            // `author` is now an i18n type, so `article.author` is a per-locale
            // relation — a shared FK would be a cross-locale link.
            const authorEn = (
                await agent
                    .post('/api/content/author')
                    .send({ values: { name: 'Ada' } })
                    .expect(201)
            ).body as { id: string };
            const en = await createArticle(agent, {
                values: {
                    text: 'EN title',
                    select: 'article',
                    number: 1,
                    author: authorEn.id
                }
            });
            // The de sibling starts with NO author (the client's prefill drops
            // a per-locale relation, so the create body omits it).
            const de = (
                await agent
                    .post('/api/content/article')
                    .send({
                        values: {
                            text: 'DE title',
                            select: 'article',
                            number: 1
                        },
                        locale: 'de',
                        localeGroupId: en.localeGroupId
                    })
                    .expect(201)
            ).body as { id: string; values: Record<string, unknown> };
            expect(de.values.author ?? null).toBeNull();

            // Edit a shared field on en — it syncs — but the author must NOT be
            // pushed onto the de sibling.
            await agent
                .patch(`/api/content/article/${en.id}`)
                .send({
                    values: {
                        text: 'EN title',
                        select: 'article',
                        number: 99,
                        author: authorEn.id
                    }
                })
                .expect(200);

            const deAfter = (
                await agent.get(`/api/content/article/${de.id}`).expect(200)
            ).body as { values: Record<string, unknown> };
            expect(deAfter.values.number).toBe(99); // shared field synced
            expect(deAfter.values.author ?? null).toBeNull(); // relation NOT synced
        });

        it('syncs shared fields when a sibling is created into the group', async () => {
            const agent = await login();
            const en = await createArticle(agent, {
                values: { text: 'EN title', select: 'article', number: 1 }
            });
            // Create the de sibling with a DIFFERENT shared `number`.
            await agent
                .post('/api/content/article')
                .send({
                    values: { text: 'DE title', select: 'article', number: 5 },
                    locale: 'de',
                    localeGroupId: en.localeGroupId
                })
                .expect(201);

            const enAfter = (
                await agent.get(`/api/content/article/${en.id}`).expect(200)
            ).body as { values: Record<string, unknown> };
            // The shared field propagates to the pre-existing en row on create...
            expect(enAfter.values.number).toBe(5);
            // ...while the localized text stays per-locale.
            expect(enAfter.values.text).toBe('EN title');
        });

        it('422s and rolls back when the sync would invalidate a published sibling', async () => {
            const agent = await login();
            const en = await createArticle(agent, {
                values: { text: 'EN title', select: 'article' }
            });
            const de = (await createTranslation(agent, en, 'de'))
                .body as { id: string };
            // Publish the de sibling so it must stay valid.
            await agent
                .post(`/api/content/article/${de.id}/publish`)
                .expect(201);

            // `select` is shared (not localized). Clearing it on en would blank
            // the published de row's required select → the sync must 422 and
            // roll the whole save back.
            await agent
                .patch(`/api/content/article/${en.id}`)
                .send({ values: { text: 'EN title', select: '' } })
                .expect(422);

            // The en row is unchanged (the transaction rolled back).
            const enAfter = await agent
                .get(`/api/content/article/${en.id}`)
                .expect(200);
            expect(enAfter.body.values.select).toBe('article');
        });
    });

    describe('locale aggregate filters', () => {
        /** The `?filter=` JSON for one rule (`op`, matching the engine). */
        const rule = (field: string, op: string, value: unknown) =>
            JSON.stringify({ field, op, value });

        it('hasLocale / missingLocale select by group membership', async () => {
            const agent = await login();
            // Group A: en + de. Group B: en only.
            const a = await createArticle(agent);
            await createTranslation(agent, a, 'de');
            const b = await createArticle(agent);

            // hasLocale=de → only group A's en row (strict default-locale list).
            const has = await agent
                .get('/api/content/article')
                .query({ filter: rule('hasLocale', 'eq', 'de') })
                .expect(200);
            const hasIds = (has.body.items as { id: string }[]).map((i) => i.id);
            expect(hasIds).toContain(a.id);
            expect(hasIds).not.toContain(b.id);

            // missingLocale=de → only group B.
            const missing = await agent
                .get('/api/content/article')
                .query({ filter: rule('missingLocale', 'eq', 'de') })
                .expect(200);
            const missingIds = (missing.body.items as { id: string }[]).map(
                (i) => i.id
            );
            expect(missingIds).toContain(b.id);
            expect(missingIds).not.toContain(a.id);
        });

        it('localeCount filters by number of translations', async () => {
            const agent = await login();
            const a = await createArticle(agent); // count 1
            await createTranslation(agent, a, 'de'); // count 2
            const b = await createArticle(agent); // count 1

            const res = await agent
                .get('/api/content/article')
                .query({ filter: rule('localeCount', 'lt', 2) })
                .expect(200);
            const ids = (res.body.items as { id: string }[]).map((i) => i.id);
            expect(ids).toContain(b.id);
            expect(ids).not.toContain(a.id);
        });
    });

    describe('locale panel + summary', () => {
        it('returns one item per configured locale, present or null', async () => {
            const agent = await login();
            const en = await createArticle(agent);
            await createTranslation(agent, en, 'de');

            const res = await agent
                .get(`/api/i18n/content/article/${en.id}/locales`)
                .expect(200);
            expect(res.body.localeGroupId).toBe(en.localeGroupId);
            const byLocale = Object.fromEntries(
                (res.body.items as { locale: string; entry: unknown }[]).map(
                    (item) => [item.locale, item.entry]
                )
            );
            expect(byLocale['en']).not.toBeNull();
            expect(byLocale['de']).not.toBeNull();
            expect(byLocale['fr']).toBeNull();
        });

        it('batches group summaries for a page of rows', async () => {
            const agent = await login();
            const en = await createArticle(agent);
            await createTranslation(agent, en, 'de');

            const res = await agent
                .post('/api/i18n/content/article/locale-summary')
                .send({ groupIds: [en.localeGroupId] })
                .expect(201);
            const members = res.body.groups[en.localeGroupId] as {
                locale: string;
            }[];
            expect(members.map((m) => m.locale).sort()).toEqual(['de', 'en']);
        });

        it('400s the locale endpoints on a non-i18n type', async () => {
            const agent = await login();
            // `seo_meta` is not localized (author is now an i18n type).
            const seoId = (
                await agent
                    .post('/api/content/seo_meta')
                    .send({ values: { metaTitle: 'Home' } })
                    .expect(201)
            ).body.id as string;
            await agent
                .get(`/api/i18n/content/seo_meta/${seoId}/locales`)
                .expect(400);
        });
    });

    describe('non-i18n regression', () => {
        it('ignores ?locale= on a non-localized type', async () => {
            const agent = await login();
            await agent
                .post('/api/content/seo_meta')
                .send({ values: { metaTitle: 'Home' } })
                .expect(201);
            // The seo_meta list ignores the locale param entirely.
            const res = await agent
                .get('/api/content/seo_meta?locale=de')
                .expect(200);
            expect(res.body.total).toBe(1);
        });
    });
});
