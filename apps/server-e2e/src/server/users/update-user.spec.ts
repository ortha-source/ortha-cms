import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countActivityRows,
    getUserByEmail,
    getUserUpdatedAt,
    resetDb,
    seedActiveUser,
    seedUser,
    seedUserWithPermissions,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'update-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `PATCH /api/users/:id` — edit a member's name and/or role. */
describe('PATCH /api/users/:id', () => {
    let harness: TestApp;
    let admin: SeededUser;

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
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('rejects an unauthenticated request with 401', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        await request(harness.server)
            .patch(`/api/users/${target.id}`)
            .send({ role: 'contributor' })
            .expect(401);
    });

    it('changes a member’s role and persists it', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);

        const res = await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'contributor' })
            .expect(200);
        expect(res.body.role.key).toBe('contributor');

        const row = await getUserByEmail('target@example.com');
        expect(row?.roleKey).toBe('contributor');
    });

    it('updates the display name', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .patch(`/api/users/${target.id}`)
            .send({ name: 'Renamed' })
            .expect(200);
        expect(res.body.name).toBe('Renamed');
    });

    it('lets a member rename themselves', async () => {
        // The self guard is deliberately role-only: it fires when `dto.role`
        // is present *and different*, so editing your own display name is an
        // ordinary edit. Nothing else pins that asymmetry down, and widening
        // the guard to the whole patch would lock every admin out of their own
        // profile.
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .patch(`/api/users/${admin.id}`)
            .send({ name: 'Ada Lovelace' })
            .expect(200);
        expect(res.body.name).toBe('Ada Lovelace');

        const row = await getUserByEmail(ADMIN_EMAIL);
        expect(row?.roleKey).toBe('admin');
    });

    it('writes nothing when the requested role is the one already held', async () => {
        const target = await seedUser(harness.app, {
            email: 'same-role@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        const updatedAt = await getUserUpdatedAt(target.id);
        const events = await countActivityRows();

        await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'viewer' })
            .expect(200);

        // The use case returns before `save`, so no UPDATE runs and no event
        // reaches the outbox. A 200 that quietly rewrote the row would be
        // indistinguishable on the wire — `updated_at` is `$onUpdate`-stamped
        // and the audit count is empty, and those are the two places it shows.
        expect(await getUserUpdatedAt(target.id)).toEqual(updatedAt);
        expect(await countActivityRows()).toBe(events);
    });

    it('refuses to demote the last remaining admin with 409', async () => {
        // The seeded admin is the only active admin — demoting them is blocked.
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${admin.id}`)
            .send({ role: 'viewer' })
            .expect(409);

        const row = await getUserByEmail(ADMIN_EMAIL);
        expect(row?.roleKey).toBe('admin');
    });

    it('allows demoting an admin when another active admin remains', async () => {
        const second = await seedUser(harness.app, {
            email: 'second-admin@example.com',
            role: 'admin',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${second.id}`)
            .send({ role: 'viewer' })
            .expect(200);
    });

    it('counts only active admins when guarding the last one', async () => {
        // A disabled admin cannot sign in, so it is not a deployment's
        // remaining administrator. Counting it would let the only usable
        // admin be demoted and lock everybody out of the members page — with
        // the row that "proves" an admin exists unable to log in and fix it.
        await seedUser(harness.app, {
            email: 'dormant-admin@example.com',
            role: 'admin',
            status: 'disabled'
        });
        await seedUserWithPermissions(harness.app, {
            email: 'ops@example.com',
            password: PASSWORD,
            roleKey: 'update-user-ops-dormant',
            permissions: ['users:read', 'users:update']
        });
        const agent = await login('ops@example.com');

        const res = await agent
            .patch(`/api/users/${admin.id}`)
            .send({ role: 'viewer' })
            .expect(409);
        expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
        expect((await getUserByEmail(ADMIN_EMAIL))?.roleKey).toBe('admin');
    });

    it('leaves one admin standing when two demotions race', async () => {
        // The only case that exercises `lockActiveAdmins` on the demote path.
        // Both transactions count-then-write the admin set; under READ
        // COMMITTED and without the advisory lock they each read two and both
        // pass, leaving a deployment with no admin at all.
        const second = await seedUser(harness.app, {
            email: 'second-admin@example.com',
            role: 'admin',
            status: 'active'
        });
        // Two principals holding users:update *without* being admins: an
        // admin aiming at another admin would be fine, but each of these has
        // to aim at someone other than themselves or SELF_ACTION fires before
        // the last-admin guard is ever consulted.
        await seedUserWithPermissions(harness.app, {
            email: 'ops-a@example.com',
            password: PASSWORD,
            roleKey: 'update-user-ops-a',
            permissions: ['users:read', 'users:update']
        });
        await seedUserWithPermissions(harness.app, {
            email: 'ops-b@example.com',
            password: PASSWORD,
            roleKey: 'update-user-ops-b',
            permissions: ['users:read', 'users:update']
        });
        const agentA = await login('ops-a@example.com');
        const agentB = await login('ops-b@example.com');

        const [first, other] = await Promise.all([
            agentA.patch(`/api/users/${admin.id}`).send({ role: 'viewer' }),
            agentB.patch(`/api/users/${second.id}`).send({ role: 'viewer' })
        ]);

        expect([first.status, other.status].sort()).toEqual([200, 409]);
        const refused = first.status === 409 ? first : other;
        expect(refused.body.code).toBe('LAST_ADMIN_PROTECTED');

        const rows = [
            await getUserByEmail(ADMIN_EMAIL),
            await getUserByEmail('second-admin@example.com')
        ];
        expect(rows.filter((row) => row?.roleKey === 'admin')).toHaveLength(1);
    });

    it('rejects an unknown role with 400', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'root' })
            .expect(400);
    });

    it('rejects an unknown extra field with 400', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch(`/api/users/${target.id}`)
            .send({ status: 'disabled' })
            .expect(400);
    });

    it('returns 404 for an unknown id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch('/api/users/00000000-0000-0000-0000-000000000000')
            .send({ role: 'viewer' })
            .expect(404);
    });

    it('returns 400 for a non-uuid id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .patch('/api/users/not-a-uuid')
            .send({ role: 'viewer' })
            .expect(400);
    });

    it('forbids a viewer (lacks users:update) with 403', async () => {
        const target = await seedUser(harness.app, {
            email: 'target@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedActiveUser(harness.app, {
            email: 'viewer@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login('viewer@example.com');
        await agent
            .patch(`/api/users/${target.id}`)
            .send({ role: 'contributor' })
            .expect(403);
    });

    describe('display name is trimmed, and may not be blank', () => {
        // `@IsNotEmpty` rejects '' but accepts '   ', and this row is the only
        // source of that person's human identifier — a blank one leaves the
        // members table, the avatar initials and the audit log's actor column
        // with nothing to render (508 §504.2).
        it('rejects a whitespace-only name with 400', async () => {
            const target = await seedUser(harness.app, {
                email: 'blank-name@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login(ADMIN_EMAIL);
            await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: '   ' })
                .expect(400);
        });

        it('rejects an empty name with 400', async () => {
            const target = await seedUser(harness.app, {
                email: 'empty-name@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login(ADMIN_EMAIL);
            await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: '' })
                .expect(400);
        });

        it('rejects an explicit null name with 400', async () => {
            // The fourth spelling of the same blank, and the one that used to
            // get through. `@IsOptional()` skips the whole chain for `null` as
            // well as `undefined`, while the use case tests presence with
            // `!== undefined` — so a `null` arrived at the aggregate as a real
            // value and cleared the stored name, producing exactly the blank
            // `''` and `'   '` are rejected for. The field is gated on
            // `@ValidateIf(name !== undefined)` now, so `@IsString` sees it.
            const target = await seedUser(harness.app, {
                email: 'null-name@example.com',
                role: 'viewer',
                status: 'active',
                name: 'Grace Hopper'
            });
            const agent = await login(ADMIN_EMAIL);
            await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: null })
                .expect(400);

            const res = await agent.get(`/api/users/${target.id}`).expect(200);
            expect(res.body.name).toBe('Grace Hopper');
        });

        it('leaves the name alone when the patch omits it', async () => {
            // The other half of the `null` case: an *absent* name still means
            // "don't touch it", so tightening the field must not turn every
            // role-only patch into a 400.
            const target = await seedUser(harness.app, {
                email: 'kept-name@example.com',
                role: 'viewer',
                status: 'active',
                name: 'Grace Hopper'
            });
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .patch(`/api/users/${target.id}`)
                .send({ role: 'contributor' })
                .expect(200);
            expect(res.body.name).toBe('Grace Hopper');
            expect(res.body.role.key).toBe('contributor');
        });

        it('trims surrounding whitespace from a real name', async () => {
            const target = await seedUser(harness.app, {
                email: 'padded-name@example.com',
                role: 'viewer',
                status: 'active'
            });
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .patch(`/api/users/${target.id}`)
                .send({ name: '  Grace Hopper  ' })
                .expect(200);
            expect(res.body.name).toBe('Grace Hopper');
        });
    });

    describe('conflict bodies carry a stable machine code', () => {
        it('tags a self role change as SELF_ACTION', async () => {
            await seedActiveUser(harness.app, {
                email: 'other-admin@example.com',
                password: PASSWORD,
                role: 'admin'
            });
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .patch(`/api/users/${admin.id}`)
                .send({ role: 'viewer' })
                .expect(409);

            expect(res.body.code).toBe('SELF_ACTION');
            // Additive: the fields clients already read are untouched.
            expect(res.body.statusCode).toBe(409);
            expect(res.body.error).toBe('Conflict');
        });

        it('tags demoting the last admin as LAST_ADMIN_PROTECTED', async () => {
            // Needs a non-admin holding users:update — an admin looking at the
            // sole admin is looking at themselves, so SELF_ACTION fires first.
            await seedUserWithPermissions(harness.app, {
                email: 'ops@example.com',
                password: PASSWORD,
                roleKey: 'update-user-ops',
                permissions: ['users:read', 'users:update']
            });
            const agent = await login('ops@example.com');
            const res = await agent
                .patch(`/api/users/${admin.id}`)
                .send({ role: 'viewer' })
                .expect(409);

            expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
        });
    });
});
