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

const ADMIN_EMAIL = 'l10n-insights-admin@example.com';
const PASSWORD = 'SecurePass123!';

const VALID = { text: 'Hello world', select: 'article' } as const;

/** The e2e host configures three locales; `en` is the default. */
const CONFIGURED = 3;

/**
 * The localization coverage read-model (`GET /api/insights/i18n/coverage`).
 *
 * The figures here are **records**, not rows, and that is the whole reason this
 * suite exists: a localized entry is one row per language, so every count runs
 * through a `locale_group_id` fold that a mocked admin test cannot exercise. The
 * three answers worth pinning are that a group in every locale reads as
 * localized, that a group in one locale reads as *both* untranslated and
 * needing work (they are a subset, not two slices), and that another
 * workspace's translations never move the numbers.
 */
describe('Localization insights (/api/insights/i18n)', () => {
    let harness: TestApp;
    let admin: SeededUser;
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
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        const ws = await seedWorkspace({ name: 'L10n WS', slug: 'l10n-ws' });
        workspaceId = ws.id;
        await seedMembership(admin.id, workspaceId);

        const other = await seedWorkspace({ name: 'Other', slug: 'l10n-oth' });
        otherWorkspaceId = other.id;
        await seedMembership(admin.id, otherWorkspaceId);
    });

    async function login(scopeTo = workspaceId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', scopeTo);
        return agent;
    }

    /** A row as the create endpoint returns it. */
    type Row = { id: string; locale: string; localeGroupId: string };

    /** Creates a record in the default locale — a fresh translation group. */
    async function createRecord(agent: request.Agent): Promise<Row> {
        const res = await agent
            .post('/api/content/test_article')
            .send({ values: VALID })
            .expect(201);
        return res.body as Row;
    }

    /** Adds a sibling translation to `source`'s group. */
    async function translate(
        agent: request.Agent,
        source: Row,
        locale: string
    ): Promise<Row> {
        const res = await agent
            .post('/api/content/test_article')
            .send({
                values: VALID,
                locale,
                localeGroupId: source.localeGroupId
            })
            .expect(201);
        return res.body as Row;
    }

    /** Reads the coverage view. */
    async function coverage(agent: request.Agent) {
        const res = await agent.get('/api/insights/i18n/coverage').expect(200);
        return res.body;
    }

    describe('GET /coverage', () => {
        it('lists every configured locale, translated or not', async () => {
            // The configured set is the point of the widget: a locale nobody has
            // written a word in must still appear, at zero. Reporting only the
            // slugs present in the data would make an untouched language
            // invisible — the exact opposite of what "coverage" means.
            const agent = await login();
            await createRecord(agent);

            const body = await coverage(agent);
            expect(
                body.locales.map((l: { locale: string }) => l.locale)
            ).toEqual(['en', 'de', 'fr']);
            expect(body.locales[0]).toMatchObject({
                locale: 'en',
                isDefault: true,
                translated: 1,
                missing: 0
            });
            expect(body.locales[2]).toMatchObject({
                locale: 'fr',
                translated: 0,
                missing: 1
            });
        });

        it('counts records, not rows', async () => {
            // One record in three languages is three rows and ONE record. A
            // count of rows would report a small workspace as three times its
            // real size and make every percentage on the card wrong.
            const agent = await login();
            const en = await createRecord(agent);
            await translate(agent, en, 'de');
            await translate(agent, en, 'fr');

            const body = await coverage(agent);
            expect(body.records).toBe(1);
            expect(body.localized).toBe(1);
            expect(body.requiresLocalization).toBe(0);
            expect(body.notLocalized).toBe(0);
        });

        it('counts a single-locale record as untranslated AND needing work', async () => {
            // These are a subset, not two slices of a pie: a record in one of
            // three languages both has no translations and needs some.
            const agent = await login();
            await createRecord(agent);

            const body = await coverage(agent);
            expect(body).toMatchObject({
                records: 1,
                localized: 0,
                notLocalized: 1,
                requiresLocalization: 1
            });
        });

        it('counts a part-way record as needing work but not untranslated', async () => {
            const agent = await login();
            const en = await createRecord(agent);
            await translate(agent, en, 'de');

            const body = await coverage(agent);
            expect(body).toMatchObject({
                records: 1,
                localized: 0,
                notLocalized: 0,
                requiresLocalization: 1
            });
        });

        it('adds up across records at different stages', async () => {
            const agent = await login();
            const complete = await createRecord(agent);
            await translate(agent, complete, 'de');
            await translate(agent, complete, 'fr');

            const partial = await createRecord(agent);
            await translate(agent, partial, 'fr');

            await createRecord(agent);

            const body = await coverage(agent);
            expect(body).toMatchObject({
                records: 3,
                localized: 1,
                notLocalized: 1,
                requiresLocalization: 2
            });
            const byLocale = Object.fromEntries(
                body.locales.map(
                    (l: { locale: string; translated: number }) => [
                        l.locale,
                        l.translated
                    ]
                )
            );
            expect(byLocale).toEqual({ en: 3, de: 1, fr: 2 });
            expect(body.locales[1]).toMatchObject({ missing: 2 });
        });

        it('reports the same figures per content type', async () => {
            // The workspace total says translation work exists; only the
            // per-type split says where it is.
            const agent = await login();
            const complete = await createRecord(agent);
            await translate(agent, complete, 'de');
            await translate(agent, complete, 'fr');
            await createRecord(agent);

            const body = await coverage(agent);
            expect(body.types).toEqual([
                {
                    name: 'test_article',
                    label: expect.any(String),
                    records: 2,
                    localized: 1,
                    notLocalized: 1,
                    requiresLocalization: 1
                }
            ]);

            // The per-type rows are the workspace figures, partitioned — the
            // one property that makes the card's two breakdowns tell the same
            // story rather than two.
            const summed = body.types.reduce(
                (
                    total: number,
                    type: { requiresLocalization: number }
                ): number => total + type.requiresLocalization,
                0
            );
            expect(summed).toBe(body.requiresLocalization);
        });

        it('omits a localized type the workspace has never used', async () => {
            // `test_author` and `test_landing` are localized too. A row of
            // zeros for each would be noise on a chart about where the
            // outstanding work sits, and would push the real rows down.
            const agent = await login();
            await createRecord(agent);

            const body = await coverage(agent);
            const names = body.types.map((type: { name: string }) => type.name);
            expect(names).toEqual(['test_article']);
        });

        it('orders types by how much content they hold', async () => {
            const agent = await login();
            await createRecord(agent);
            await createRecord(agent);
            await agent
                .post('/api/content/test_author')
                .send({ values: { name: 'Ada' } })
                .expect(201);

            const body = await coverage(agent);
            expect(
                body.types.map((type: { name: string }) => type.name)
            ).toEqual(['test_article', 'test_author']);
        });

        it('drops a soft-deleted translation from its record’s coverage', async () => {
            // A tombstoned sibling is still a row. Counting it would report a
            // language as translated when the translation is in the trash.
            const agent = await login();
            const en = await createRecord(agent);
            const de = await translate(agent, en, 'de');
            await translate(agent, en, 'fr');

            await agent
                .delete(`/api/content/test_article/${de.id}`)
                .expect(204);

            const body = await coverage(agent);
            expect(body.records).toBe(1);
            expect(body.localized).toBe(0);
            expect(body.requiresLocalization).toBe(1);
            expect(body.locales[1]).toMatchObject({
                locale: 'de',
                translated: 0,
                missing: 1
            });
        });

        it('is empty for a workspace with no content', async () => {
            const agent = await login();
            const body = await coverage(agent);
            expect(body.records).toBe(0);
            expect(body.localized).toBe(0);
            expect(body.requiresLocalization).toBe(0);
            expect(body.locales).toHaveLength(CONFIGURED);
            expect(
                body.locales.every(
                    (l: { translated: number }) => l.translated === 0
                )
            ).toBe(true);
            // Localized types exist — the workspace just hasn't used them — but
            // a row of zeros per type is not a report, so the breakdown is
            // empty and `records: 0` is what tells the card to say "nothing
            // yet".
            expect(body.types).toEqual([]);
        });

        it('counts only the workspace named by the header', async () => {
            const here = await login();
            await createRecord(here);

            const there = await login(otherWorkspaceId);
            const other = await createRecord(there);
            await translate(there, other, 'de');
            await translate(there, other, 'fr');

            expect(await coverage(here)).toMatchObject({
                records: 1,
                localized: 0
            });
            expect(await coverage(there)).toMatchObject({
                records: 1,
                localized: 1
            });
        });
    });

    describe('authorization', () => {
        it('401s without a session', async () => {
            await request(harness.server)
                .get('/api/insights/i18n/coverage')
                .set('X-Workspace-Id', workspaceId)
                .expect(401);
        });

        it('400s without a workspace header', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);
            await agent.get('/api/insights/i18n/coverage').expect(400);
        });

        it('403s for a workspace the caller is not a member of', async () => {
            const outsider = await seedWorkspace({
                name: 'Not Mine',
                slug: 'l10n-not-mine'
            });
            const agent = await login(outsider.id);
            await agent.get('/api/insights/i18n/coverage').expect(403);
        });
    });
});
