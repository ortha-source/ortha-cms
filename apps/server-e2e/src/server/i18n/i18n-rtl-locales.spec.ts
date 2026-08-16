import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const EMAIL = 'i18n-rtl@example.com';

/**
 * An RTL locale, end to end.
 *
 * The harness configures en/de/fr — three LTR locales — so `inferLocaleDir`'s
 * `rtl` branch, and every consumer that depends on it, were never exercised by
 * a real boot. The direction is the one piece of the locale contract the admin
 * cannot derive for itself (WCAG 1.3.2 Meaningful Sequence, 3.1.2 Language of
 * Parts), so "the wire always carries a resolved dir" is worth proving for the
 * case where the answer is not the default.
 */
describe('i18n locales (RTL)', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp({
            locales: [
                { slug: 'en', name: 'English', isDefault: true },
                { slug: 'ar', name: 'العربية' },
                { slug: 'az-arab', name: 'Azerbaijani (Arabic)' }
            ]
        });
    });
    afterAll(async () => {
        await closeTestApp(harness);
    });
    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(harness.app, {
            email: EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
    });

    it('infers rtl from the language subtag, and from a script subtag', async () => {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: EMAIL, password: PASSWORD })
            .expect(201);

        const res = await agent.get('/api/i18n/locales').expect(200);
        const byslug = Object.fromEntries(
            (res.body.items as { slug: string; dir: string }[]).map((item) => [
                item.slug,
                item.dir
            ])
        );
        expect(byslug).toEqual({ en: 'ltr', ar: 'rtl', 'az-arab': 'rtl' });
    });

    it('lets an explicit dir override the inference', async () => {
        const other = await createTestApp({
            locales: [
                { slug: 'en', name: 'English', isDefault: true },
                // A constructed language written left-to-right in this
                // deployment: the config is the more specific statement.
                { slug: 'ar', name: 'Arabic (transliterated)', dir: 'ltr' }
            ]
        });
        try {
            await resetDb();
            await seedActiveUser(other.app, {
                email: EMAIL,
                password: PASSWORD,
                role: 'admin'
            });
            const agent = request.agent(other.server);
            await agent
                .post('/api/auth/login')
                .send({ email: EMAIL, password: PASSWORD })
                .expect(201);
            const res = await agent.get('/api/i18n/locales').expect(200);
            const ar = (res.body.items as { slug: string; dir: string }[]).find(
                (item) => item.slug === 'ar'
            );
            expect(ar?.dir).toBe('ltr');
        } finally {
            await closeTestApp(other);
        }
    });
});
