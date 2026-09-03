import { createHash } from 'node:crypto';
import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    getInviteTokenHashes,
    getUserByEmail,
    getWorkspaceIdsForUser,
    resetDb,
    seedActiveUser,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'invite-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `POST /api/users/invites` — invite a person by email. */
describe('POST /api/users/invites', () => {
    let harness: TestApp;

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
        await request(harness.server)
            .post('/api/users/invites')
            .send({ email: 'new@example.com', role: 'viewer' })
            .expect(401);
    });

    it('creates a pending member, assigns the role, and issues an invite token', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/users/invites')
            .send({
                email: 'New@Example.com',
                role: 'contributor',
                name: 'Newbie'
            })
            .expect(201);

        expect(res.body.status).toBe('pending');
        expect(res.body.role.key).toBe('contributor');
        expect(res.body.name).toBe('Newbie');

        // Email is persisted lower-cased; the row is pending with a token.
        const row = await getUserByEmail('new@example.com');
        expect(row).not.toBeNull();
        expect(row?.status).toBe('pending');
        expect(row?.roleKey).toBe('contributor');
        expect(row?.passwordHash).toBeNull();

        const tokenHashes = await getInviteTokenHashes(row!.id);
        expect(tokenHashes).toHaveLength(1);
    });

    it('assigns the new member to the given workspaces (unknown ids ignored)', async () => {
        const agent = await login(ADMIN_EMAIL);
        const ws = await seedWorkspace({
            name: 'Marketing',
            slug: 'marketing'
        });

        const res = await agent
            .post('/api/users/invites')
            .send({
                email: 'assigned@example.com',
                role: 'viewer',
                // a real workspace plus a well-formed but nonexistent id
                workspaceIds: [ws.id, '11111111-1111-4111-8111-111111111111']
            })
            .expect(201);

        // The real workspace is linked; the unknown id is silently dropped.
        const ids = await getWorkspaceIdsForUser(res.body.id);
        expect(ids).toEqual([ws.id]);
    });

    it('rejects a non-UUID workspace id with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({
                email: 'bad-ws@example.com',
                role: 'viewer',
                workspaceIds: ['not-a-uuid']
            })
            .expect(400);
    });

    it('rejects a repeated workspace id with 400', async () => {
        // The linker de-dupes on its way to `memberships`, so a tolerated
        // duplicate and a rejected one leave the database in the same state.
        // The status code is the only thing that says which contract the API
        // is offering — `@ArrayUnique` means "this list is wrong", not "we
        // tidied it up for you".
        const agent = await login(ADMIN_EMAIL);
        const ws = await seedWorkspace({ name: 'Sales', slug: 'sales' });
        await agent
            .post('/api/users/invites')
            .send({
                email: 'repeat-ws@example.com',
                role: 'viewer',
                workspaceIds: [ws.id, ws.id]
            })
            .expect(400);
    });

    it('rejects a duplicate email with 409', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'dupe@example.com', role: 'viewer' })
            .expect(201);
        await agent
            .post('/api/users/invites')
            .send({ email: 'dupe@example.com', role: 'viewer' })
            .expect(409);
    });

    it('lets only one of two concurrent invites to one address through [users:I-10]', async () => {
        // Deliberately through the route, so the **index** is the backstop
        // under test: `email-uniqueness.spec.ts` proves it with raw inserts
        // that bypass the endpoint entirely, which says nothing about whether
        // the endpoint reaches it. Both requests can clear
        // `existsByEmail` before either commits, and the loser is then caught
        // by `users_email_lower_unique` and mapped to the same
        // `EmailTakenError` the pre-check raises.
        //
        // Which of the two refused it is not observable from out here, and it
        // does not need to be — the guarantee is that no interleaving leaves
        // two accounts holding one address.
        const agent = await login(ADMIN_EMAIL);
        const [first, second] = await Promise.all([
            agent
                .post('/api/users/invites')
                .send({ email: 'race@example.com', role: 'viewer' }),
            agent
                .post('/api/users/invites')
                .send({ email: 'race@example.com', role: 'viewer' })
        ]);

        expect([first.status, second.status].sort()).toEqual([201, 409]);
        const refused = first.status === 409 ? first : second;
        expect(refused.body.code).toBe('EMAIL_TAKEN');

        const listed = await agent
            .get('/api/users')
            .query({ search: 'race@example.com' })
            .expect(200);
        expect(listed.body.total).toBe(1);
    });

    it('treats an existing email case-insensitively (409) [users:I-10]', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: ADMIN_EMAIL.toUpperCase(), role: 'viewer' })
            .expect(409);
    });

    it('rejects a malformed email with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'not-an-email', role: 'viewer' })
            .expect(400);
    });

    it('rejects an unknown role with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'superuser' })
            .expect(400);
    });

    it('rejects an unknown extra field with 400', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'viewer', isAdmin: true })
            .expect(400);
    });

    it('forbids a contributor (lacks users:create) with 403', async () => {
        await seedActiveUser(harness.app, {
            email: 'contributor@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        const agent = await login('contributor@example.com');
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'viewer' })
            .expect(403);
    });

    it('forbids a viewer (lacks users:create) with 403', async () => {
        // The contributor case above covers the middle role; a viewer is the
        // one an admin is most likely to hand out casually, and inviting is
        // how the member list grows — so it needs its own line rather than an
        // assumption that the three roles behave alike.
        await seedActiveUser(harness.app, {
            email: 'viewer@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login('viewer@example.com');
        await agent
            .post('/api/users/invites')
            .send({ email: 'x@example.com', role: 'viewer' })
            .expect(403);
    });

    it('stores the SHA-256 of the invite token, never the token', async () => {
        // The raw token is the invite link's secret half and is returned
        // exactly once. If the column held it verbatim, a read-only leak of
        // `tokens` would be a set of live account-activation links.
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/users/invites')
            .send({ email: 'hashed@example.com', role: 'viewer' })
            .expect(201);

        const [stored] = await getInviteTokenHashes(res.body.id);
        expect(stored).toBe(
            createHash('sha256').update(res.body.inviteToken).digest('hex')
        );
        expect(stored).not.toBe(res.body.inviteToken);
        expect(stored).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a whitespace-only name with 400', async () => {
        // Same blank-accessible-name guard as PATCH; the invite path is the
        // other way a member row is first written.
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/invites')
            .send({
                email: 'blank-invite@example.com',
                role: 'viewer',
                name: '   '
            })
            .expect(400);
    });

    it('trims surrounding whitespace from the name', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/users/invites')
            .send({
                email: 'padded-invite@example.com',
                role: 'viewer',
                name: '  Grace Hopper  '
            })
            .expect(201);
        expect(res.body.name).toBe('Grace Hopper');
    });
});
