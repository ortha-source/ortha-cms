import request from 'supertest';
import type { Response } from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedUser,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';

// Ada is an admin and member of Alpha + Bravo; Grace is a viewer and member of
// Bravo + Charlie; Nemo is a member of Alpha with NO display name (exercises the
// nullable `users.name`); Solo is a member of nothing.
const ADA = 'ada@example.com';
const GRACE = 'grace@example.com';
const NEMO = 'nemo@example.com';
const SOLO = 'solo@example.com';

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

/** `GET /api/workspaces` — lists the caller's workspaces with their members. */
describe('GET /api/workspaces', () => {
    let harness: TestApp;
    let alpha: SeededWorkspace;
    let bravo: SeededWorkspace;
    let charlie: SeededWorkspace;
    let ada: SeededUser;
    let grace: SeededUser;
    let nemo: SeededUser;
    let solo: SeededUser;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();

        ada = await seedActiveUser(harness.app, {
            email: ADA,
            password: PASSWORD,
            role: 'admin',
            name: 'Ada Lovelace'
        });
        grace = await seedActiveUser(harness.app, {
            email: GRACE,
            password: PASSWORD,
            role: 'viewer',
            name: 'Grace Hopper'
        });
        // No `name` — stored as null.
        nemo = await seedUser(harness.app, {
            email: NEMO,
            password: PASSWORD,
            role: 'viewer',
            status: 'active'
        });
        solo = await seedActiveUser(harness.app, {
            email: SOLO,
            password: PASSWORD,
            role: 'viewer',
            name: 'Solo Member'
        });

        alpha = await seedWorkspace({
            name: 'Alpha Site',
            slug: 'alpha',
            description: 'The alpha workspace.'
        });
        bravo = await seedWorkspace({ name: 'Bravo Hub', slug: 'bravo' });
        charlie = await seedWorkspace({ name: 'Charlie Docs', slug: 'charlie' });

        await seedMembership(ada.id, alpha.id);
        await seedMembership(ada.id, bravo.id);
        await seedMembership(grace.id, bravo.id);
        await seedMembership(grace.id, charlie.id);
        await seedMembership(nemo.id, alpha.id);
    });

    const get = () => request(harness.server).get('/api/workspaces');

    /** Log in as `email` and return the raw session cookie pair. */
    async function login(email: string): Promise<string> {
        const res = await request(harness.server)
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
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
    });

    describe('authenticated', () => {
        it('returns only the workspaces the caller is a member of', async () => {
            const res = await get()
                .set('Cookie', await login(ADA))
                .expect(200);

            expect(res.body.map((w: { slug: string }) => w.slug)).toEqual([
                'alpha',
                'bravo'
            ]);
        });

        it('exposes exactly the documented workspace + member fields', async () => {
            const res = await get()
                .set('Cookie', await login(ADA))
                .expect(200);

            const workspace = res.body.find(
                (w: { slug: string }) => w.slug === 'alpha'
            );
            expect(Object.keys(workspace).sort()).toEqual([
                'createdAt',
                'description',
                'id',
                'members',
                'name',
                'slug',
                'updatedAt'
            ]);
            expect(workspace.description).toBe('The alpha workspace.');
            expect(Object.keys(workspace.members[0]).sort()).toEqual([
                'email',
                'id',
                'name'
            ]);
        });

        it('returns a null description when none is set', async () => {
            const res = await get()
                .set('Cookie', await login(ADA))
                .expect(200);

            const bravoView = res.body.find(
                (w: { slug: string }) => w.slug === 'bravo'
            );
            expect(bravoView.description).toBeNull();
        });

        it('embeds every member of a shared workspace, not just the caller', async () => {
            const res = await get()
                .set('Cookie', await login(ADA))
                .expect(200);

            const bravoView = res.body.find(
                (w: { slug: string }) => w.slug === 'bravo'
            );
            // Ordered by name (no client-side sort) — verifies the query's
            // `orderBy(users.name, users.id)`: Ada Lovelace before Grace Hopper.
            expect(
                bravoView.members.map((m: { name: string }) => m.name)
            ).toEqual(['Ada Lovelace', 'Grace Hopper']);
            expect(
                bravoView.members.map((m: { email: string }) => m.email)
            ).toEqual([ADA, GRACE]);
        });

        it('tolerates a member with no display name (null, not fabricated)', async () => {
            const res = await get()
                .set('Cookie', await login(ADA))
                .expect(200);

            const alphaView = res.body.find(
                (w: { slug: string }) => w.slug === 'alpha'
            );
            const nemoView = alphaView.members.find(
                (m: { email: string }) => m.email === NEMO
            );
            expect(nemoView.name).toBeNull();
        });

        it('orders the workspaces by name', async () => {
            const res = await get()
                .set('Cookie', await login(GRACE))
                .expect(200);

            expect(res.body.map((w: { name: string }) => w.name)).toEqual([
                'Bravo Hub',
                'Charlie Docs'
            ]);
        });

        it('breaks ties between equal-named workspaces by id', async () => {
            // Two workspaces share a name, so `name` alone leaves their order
            // undefined — only the `id` tiebreaker makes it stable. Solo (a
            // member of nothing in the base seed) joins both.
            const one = await seedWorkspace({ name: 'Tied', slug: 'tied-1' });
            const two = await seedWorkspace({ name: 'Tied', slug: 'tied-2' });
            const three = await seedWorkspace({ name: 'Tied', slug: 'tied-3' });
            await seedMembership(solo.id, one.id);
            await seedMembership(solo.id, two.id);
            await seedMembership(solo.id, three.id);

            const res = await get()
                .set('Cookie', await login(SOLO))
                .expect(200);

            // Canonical uuids sort lexically the same as Postgres orders them.
            const tiedIds = res.body
                .filter((w: { name: string }) => w.name === 'Tied')
                .map((w: { id: string }) => w.id);
            expect(tiedIds).toEqual([one.id, two.id, three.id].sort());
        });

        it('breaks ties between members with no display name by id', async () => {
            // Several members of one workspace all lack a display name, so
            // `users.name` is null for each — only the `id` tiebreaker keeps
            // their order stable.
            const hub = await seedWorkspace({ name: 'Anon', slug: 'anon' });
            const anons = await Promise.all(
                ['anon1', 'anon2', 'anon3'].map((handle) =>
                    seedUser(harness.app, {
                        email: `${handle}@example.com`,
                        password: PASSWORD,
                        role: 'viewer',
                        status: 'active'
                    })
                )
            );
            for (const anon of anons) {
                await seedMembership(anon.id, hub.id);
            }

            const res = await get()
                .set('Cookie', await login('anon1@example.com'))
                .expect(200);

            const anonHub = res.body.find(
                (w: { slug: string }) => w.slug === 'anon'
            );
            const memberIds = anonHub.members.map((m: { id: string }) => m.id);
            expect(memberIds).toEqual(anons.map((a) => a.id).sort());
        });

        it('returns an empty list for a user with no memberships', async () => {
            const res = await get()
                .set('Cookie', await login(SOLO))
                .expect(200);

            expect(res.body).toEqual([]);
        });
    });
});
