import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';

/**
 * The one identity configuration that cannot possibly work, refused at
 * construction rather than at sign-in time.
 *
 * An identity provider returns the person with a **top-level cross-site
 * navigation**. A `strict` session cookie is not sent on one, so the callback
 * finds no attempt and every SSO sign-in fails — with the same generic
 * `?error=sso` every other failure produces, because an anonymous caller may not
 * be told more. Nothing in the response distinguishes it from a misconfigured
 * tenant, so the only way to diagnose it is by reading `Set-Cookie` headers.
 *
 * `IdentityPlugin` therefore throws while the plugin list is being built, which
 * is *before* `createTestApp` gets as far as opening a connection — so the
 * assertion here is on the harness's own boot, and the message has to name the
 * setting rather than merely failing.
 *
 * The two control cases are what make this test mean anything: the refusal is
 * about the **pair**, so `strict` on its own and providers on their own must
 * both boot. Without them a plugin that refused every `strict` cookie, or every
 * SSO registration, would pass.
 */
describe('identity boot refusal (strict cookie + SSO providers)', () => {
    it('refuses to build the app, naming the setting [identity:I-26]', async () => {
        await expect(
            createTestApp({ session: { cookieSameSite: 'strict' } })
        ).rejects.toThrow(/cookieSameSite/);
    });

    it('explains why, rather than only that it refused', async () => {
        await expect(
            createTestApp({ session: { cookieSameSite: 'strict' } })
        ).rejects.toThrow(/would not send the session cookie/);
    });

    it('boots with a strict cookie when no provider is registered', async () => {
        // The refusal is about the pair. A deployment that runs no identity
        // provider is free to harden its cookie, and must not be stopped.
        const harness: TestApp = await createTestApp({
            session: { cookieSameSite: 'strict' },
            ssoProviders: 'none'
        });
        try {
            const res = await request(harness.server)
                .get('/api/auth/sso')
                .expect(200);
            expect(res.body).toEqual([]);
        } finally {
            await closeTestApp(harness);
        }
    });

    it('boots with providers registered on the default lax cookie', async () => {
        // The other half of the pair: `lax` is the shipped default and is
        // exactly what SSO needs, so registering providers on it is the
        // ordinary configuration.
        const harness: TestApp = await createTestApp();
        try {
            const res = await request(harness.server)
                .get('/api/auth/sso')
                .expect(200);
            expect(res.body).toEqual([
                { name: 'fake', label: 'Fake IdP', kind: 'oidc' }
            ]);

            // …and the cookie really is `lax`, so this control is not passing
            // because the override was ignored.
            const started = await request(harness.server)
                .get('/api/auth/sso/fake/start')
                .expect(302);
            const cookies = started.headers[
                'set-cookie'
            ] as unknown as string[];
            expect(cookies.join(';').toLowerCase()).toContain('samesite=lax');
        } finally {
            await closeTestApp(harness);
        }
    });
});
