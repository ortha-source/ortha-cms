import request from 'supertest';
import type { Response } from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const EMAIL = 'preferences-test@example.com';
const PASSWORD = 'SecurePass123!';

/** Extract the `orthacms_session=value` pair from a login response. */
function sessionCookie(res: Response): string {
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie
        .find((c) => c.startsWith('orthacms_session='))
        ?.split(';')[0];
    if (!cookie) {
        throw new Error('login did not set a session cookie');
    }
    return cookie;
}

/**
 * `GET`/`PUT /api/preferences` — the current user's own appearance preferences
 * (the theme behind the account Preferences tab, and the admin's resizable
 * panel layout). Self-service: every request reads/writes the caller's own row,
 * keyed off the session, so there is no RBAC to exercise here — only auth,
 * validation, the origin guard, and the upsert's partial-patch semantics.
 */
describe('/api/preferences', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        // A signed-in caller — the endpoint keys off the session, not a passed
        // id, so we only need valid credentials, not the returned row.
        await seedActiveUser(harness.app, {
            email: EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
    });

    /** Log in and return the raw session cookie pair. */
    async function login(): Promise<string> {
        const res = await request(harness.server)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: PASSWORD })
            .expect(201);
        return sessionCookie(res);
    }

    describe('GET (read)', () => {
        it('defaults to the system theme before anything is saved', async () => {
            const res = await request(harness.server)
                .get('/api/preferences')
                .set('Cookie', await login())
                .expect(200);
            expect(res.body).toEqual({ theme: 'system', layout: {} });
        });

        it('returns only the theme and layout (no userId/timestamps leak)', async () => {
            const res = await request(harness.server)
                .get('/api/preferences')
                .set('Cookie', await login())
                .expect(200);
            expect(Object.keys(res.body).sort()).toEqual(['layout', 'theme']);
        });

        it('rejects an unauthenticated read with 401', async () => {
            await request(harness.server).get('/api/preferences').expect(401);
        });
    });

    describe('PUT (upsert)', () => {
        it('creates the row on first save and returns the new theme', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: EMAIL, password: PASSWORD })
                .expect(201);

            const put = await agent
                .put('/api/preferences')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ theme: 'dark' })
                .expect(200);
            expect(put.body).toEqual({ theme: 'dark', layout: {} });

            // The change is durable — a fresh read reflects it.
            const get = await agent.get('/api/preferences').expect(200);
            expect(get.body).toEqual({ theme: 'dark', layout: {} });
        });

        it('updates the existing row on a second save (no duplicate)', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: EMAIL, password: PASSWORD })
                .expect(201);
            const save = (theme: string) =>
                agent
                    .put('/api/preferences')
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ theme })
                    .expect(200);

            await save('dark');
            const second = await save('light');
            expect(second.body).toEqual({ theme: 'light', layout: {} });

            const get = await agent.get('/api/preferences').expect(200);
            expect(get.body).toEqual({ theme: 'light', layout: {} });
        });

        it('accepts each valid theme', async () => {
            const cookie = await login();
            for (const theme of ['light', 'dark', 'system'] as const) {
                const res = await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', cookie)
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ theme })
                    .expect(200);
                expect(res.body.theme).toBe(theme);
            }
        });

        it('rejects an unauthenticated write with 401', async () => {
            await request(harness.server)
                .put('/api/preferences')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ theme: 'dark' })
                .expect(401);
        });

        describe('validation (400)', () => {
            it('rejects a theme outside the enum', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ theme: 'neon' })
                    .expect(400);
            });

            it('rejects a patch that names nothing', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({})
                    .expect(400);
            });

            it('rejects a non-string theme', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ theme: 3 })
                    .expect(400);
            });

            it('rejects an unknown extra field (forbidNonWhitelisted)', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ theme: 'dark', density: 'compact' })
                    .expect(400);
            });
        });

        describe('layout (the resizable panels)', () => {
            /** A logged-in agent, so the session rides along on every call. */
            async function signedIn() {
                const agent = request.agent(harness.server);
                await agent
                    .post('/api/auth/login')
                    .send({ email: EMAIL, password: PASSWORD })
                    .expect(201);
                return agent;
            }

            /** `PUT` a patch through `agent`, expecting `status`. */
            function put(
                agent: ReturnType<typeof request.agent>,
                body: object,
                status = 200
            ) {
                return agent
                    .put('/api/preferences')
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send(body)
                    .expect(status);
            }

            it('stores a panel layout and reads it back', async () => {
                const agent = await signedIn();
                const layout = {
                    'shell.sidebar': { width: 288, collapsed: false }
                };

                const saved = await put(agent, { layout });
                expect(saved.body).toEqual({ theme: 'system', layout });

                const get = await agent.get('/api/preferences').expect(200);
                expect(get.body.layout).toEqual(layout);
            });

            it('merges per panel: a save leaves every panel it does not name alone', async () => {
                const agent = await signedIn();
                await put(agent, {
                    layout: {
                        'shell.sidebar': { width: 300 },
                        'shell.rightPanel': { width: 400, collapsed: true }
                    }
                });

                // Another tab resizes one panel. The other must survive it —
                // and the named panel is replaced whole, not deep-merged.
                const second = await put(agent, {
                    layout: { 'shell.rightPanel': { width: 500 } }
                });
                expect(second.body.layout).toEqual({
                    'shell.sidebar': { width: 300 },
                    'shell.rightPanel': { width: 500 }
                });
            });

            it('a theme save keeps the layout, and a layout save keeps the theme', async () => {
                const agent = await signedIn();
                await put(agent, { theme: 'dark' });
                await put(agent, {
                    layout: { 'copilot.agentsRail': { width: 320 } }
                });
                const afterTheme = await put(agent, { theme: 'light' });

                expect(afterTheme.body).toEqual({
                    theme: 'light',
                    layout: { 'copilot.agentsRail': { width: 320 } }
                });
            });

            it.each([
                ['a malformed panel id', { 'Shell sidebar': { width: 300 } }],
                ['a single-segment panel id', { sidebar: { width: 300 } }],
                ['a width below the floor', { 'shell.sidebar': { width: 10 } }],
                [
                    'a width above the ceiling',
                    { 'shell.sidebar': { width: 99999 } }
                ],
                ['a fractional width', { 'shell.sidebar': { width: 300.5 } }],
                ['a string width', { 'shell.sidebar': { width: '300' } }],
                [
                    'a non-boolean collapsed',
                    { 'shell.sidebar': { collapsed: 'yes' } }
                ],
                [
                    'an unknown inner key',
                    { 'shell.sidebar': { width: 300, height: 9 } }
                ],
                ['an empty entry', { 'shell.sidebar': {} }],
                ['an empty map', {}],
                ['an array', [{ width: 300 }]]
            ])('rejects %s with 400', async (_name, layout) => {
                const agent = await signedIn();
                await put(agent, { layout }, 400);
            });

            it('rejects more panels in one save than the bound', async () => {
                const agent = await signedIn();
                const layout = Object.fromEntries(
                    Array.from({ length: 17 }, (_, i) => [
                        `test.panel${i}`,
                        { width: 300 }
                    ])
                );
                await put(agent, { layout }, 400);
            });

            it('refuses to grow the stored map past its bound, one save at a time (422)', async () => {
                const agent = await signedIn();
                // 64 panels in four saves of 16 — each within the per-save bound.
                for (let batch = 0; batch < 4; batch++) {
                    const layout = Object.fromEntries(
                        Array.from({ length: 16 }, (_, i) => [
                            `test.panel${batch * 16 + i}`,
                            { width: 300 }
                        ])
                    );
                    await put(agent, { layout });
                }

                // A 65th is refused, and the stored map is left as it was…
                await put(
                    agent,
                    { layout: { 'test.oneTooMany': { width: 300 } } },
                    422
                );
                const get = await agent.get('/api/preferences').expect(200);
                expect(Object.keys(get.body.layout)).toHaveLength(64);

                // …while re-saving a panel already stored is still fine.
                await put(agent, {
                    layout: { 'test.panel0': { width: 320 } }
                });
            });
        });

        describe('OriginGuard (CSRF defense)', () => {
            it('rejects a disallowed Origin with 403', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .set('Origin', 'http://evil.example')
                    .send({ theme: 'dark' })
                    .expect(403);
            });

            it('allows the configured Origin', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ theme: 'dark' })
                    .expect(200);
            });

            it('allows a request with no Origin header', async () => {
                await request(harness.server)
                    .put('/api/preferences')
                    .set('Cookie', await login())
                    .send({ theme: 'dark' })
                    .expect(200);
            });
        });
    });
});
