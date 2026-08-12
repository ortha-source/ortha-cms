import request from 'supertest';
import type { Response } from 'supertest';
import { PERMISSION_KEYS } from '@ortha-cms/identity-server';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    deleteUser,
    expireUserSessions,
    resetDb,
    revokeUserSessions,
    seedActiveUser,
    setUserStatus,
    type SeededUser
} from '../../support/seed';

const EMAIL = 'me-test@example.com';
const PASSWORD = 'SecurePass123!';
const NAME = 'Me Test';

/** Extract the `ortha_session=value` pair from a login response. */
function sessionCookie(res: Response): string {
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie
        .find((c) => c.startsWith('ortha_session='))
        ?.split(';')[0];
    if (!cookie) {
        throw new Error('login did not set a session cookie');
    }
    return cookie;
}

/** `GET /api/auth/me` — resolves the current user from the session cookie. */
describe('GET /api/auth/me', () => {
    let harness: TestApp;
    let user: SeededUser;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        user = await seedActiveUser(harness.app, {
            email: EMAIL,
            password: PASSWORD,
            role: 'admin',
            name: NAME
        });
    });

    const get = () => request(harness.server).get('/api/auth/me');

    /** Log in and return the raw session cookie pair. */
    async function login(): Promise<string> {
        const res = await request(harness.server)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: PASSWORD })
            .expect(201);
        return sessionCookie(res);
    }

    describe('unauthenticated (401)', () => {
        it('rejects a request with no cookie', async () => {
            await get().expect(401);
        });

        it('rejects a bogus session token', async () => {
            await get()
                .set('Cookie', 'ortha_session=not-a-real-token')
                .expect(401);
        });

        it('rejects an empty session cookie value', async () => {
            await get().set('Cookie', 'ortha_session=').expect(401);
        });

        it('rejects when only unrelated cookies are present', async () => {
            await get().set('Cookie', 'theme=dark; lang=en').expect(401);
        });

        it('rejects a malformed cookie header', async () => {
            await get().set('Cookie', 'garbage-without-equals').expect(401);
        });
    });

    describe('authenticated', () => {
        it('returns the current user after login (cookie flow)', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: EMAIL, password: PASSWORD })
                .expect(201);

            const res = await agent.get('/api/auth/me').expect(200);
            expect(res.body).toEqual(
                expect.objectContaining({
                    id: user.id,
                    email: EMAIL,
                    name: NAME,
                    status: 'active'
                })
            );
            expect(typeof res.body.roleId).toBe('string');
        });

        it('exposes only the public fields (no hash/token leak)', async () => {
            const res = await get()
                .set('Cookie', await login())
                .expect(200);
            expect(Object.keys(res.body).sort()).toEqual([
                'email',
                'id',
                'name',
                'permissions',
                'roleId',
                'status'
            ]);
        });

        it('includes exactly the permission keys the user’s role grants', async () => {
            const res = await get()
                .set('Cookie', await login())
                .expect(200);
            // The seeded user is an admin, so they hold the full catalogue —
            // and *only* the catalogue. Asserting the exact set rather than a
            // superset is the point: `seedSystemRoles` was additive-only, so a
            // permission deleted from the code (ADR-0009 removed
            // `copilot:configure`) stayed granted in the database forever and
            // an admin kept being handed a key that no longer exists.
            expect(Array.isArray(res.body.permissions)).toBe(true);
            expect([...res.body.permissions].sort()).toEqual(
                [...PERMISSION_KEYS].sort()
            );
        });

        it('grants a viewer exactly the read-only set', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: 'me-viewer@example.com',
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: viewer.email, password: PASSWORD })
                .expect(201);

            const res = await agent.get('/api/auth/me').expect(200);
            expect([...res.body.permissions].sort()).toEqual(
                [
                    'workspaces:read',
                    'users:read',
                    'content:read',
                    'media:read',
                    'copilot:use'
                ].sort()
            );
        });

        it('works with an explicitly forwarded session cookie', async () => {
            await get()
                .set('Cookie', await login())
                .expect(200);
        });

        it('finds the session cookie among several cookies', async () => {
            const cookie = await login();
            await get()
                .set('Cookie', `theme=dark; ${cookie}; lang=en`)
                .expect(200);
        });

        it('reflects the user’s assigned role', async () => {
            const res = await get()
                .set('Cookie', await login())
                .expect(200);
            // The seeded user is an admin; roleId must be a real role id.
            expect(res.body.roleId).toEqual(expect.any(String));
        });
    });

    describe('invalidated sessions (401)', () => {
        it('rejects an expired session', async () => {
            const cookie = await login();
            await expireUserSessions(user.id);
            await get().set('Cookie', cookie).expect(401);
        });

        it('rejects a revoked session', async () => {
            const cookie = await login();
            await revokeUserSessions(user.id);
            await get().set('Cookie', cookie).expect(401);
        });

        it('rejects a session whose user was deleted', async () => {
            const cookie = await login();
            await deleteUser(user.id);
            await get().set('Cookie', cookie).expect(401);
        });

        /**
         * Disabling through the API also revokes the member's sessions, so this
         * suspends the account behind the API's back — the state a login racing
         * a disable can leave behind. The cookie is still live; the account is
         * not, and the resolve must refuse it on that alone.
         */
        it('rejects a live session whose account was suspended', async () => {
            const cookie = await login();
            await setUserStatus(user.id, 'disabled');
            await get().set('Cookie', cookie).expect(401);
        });

        it('accepts the same session again once the account is reactivated', async () => {
            const cookie = await login();
            await setUserStatus(user.id, 'disabled');
            await get().set('Cookie', cookie).expect(401);

            await setUserStatus(user.id, 'active');
            await get().set('Cookie', cookie).expect(200);
        });

        it('rejects a live session whose account fell back to pending', async () => {
            const cookie = await login();
            await setUserStatus(user.id, 'pending');
            await get().set('Cookie', cookie).expect(401);
        });
    });
});
