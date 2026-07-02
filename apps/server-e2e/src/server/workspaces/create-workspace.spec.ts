import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    type SeededUser,
    type SystemRoleKey
} from '../../support/seed';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const PASSWORD = 'SecurePass123!';
const ADMIN_EMAIL = 'ws-admin@example.com';

/** A valid create-workspace body, with optional field overrides. */
function validBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        members: [],
        content: { mode: 'all' },
        ...overrides
    };
}

/**
 * `POST /api/workspaces` — creates a workspace. Requires authentication
 * (app-wide `AuthGuard`), the `workspaces:create` permission
 * (`PermissionsGuard`), and a same-origin request (`OriginGuard`).
 */
describe('POST /api/workspaces', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
    });

    /** Seed a user of `role`, log them in, and return the user + cookie agent. */
    async function loginAs(
        role: SystemRoleKey,
        email: string
    ): Promise<{ user: SeededUser; agent: ReturnType<typeof request.agent> }> {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return { user, agent };
    }

    describe('authenticated admin (holds workspaces:create)', () => {
        it('creates a workspace and seeds the creator as its sole member', async () => {
            const { user, agent } = await loginAs('admin', ADMIN_EMAIL);

            const res = await agent
                .post('/api/workspaces')
                .send(validBody())
                .expect(201);

            expect(Object.keys(res.body).sort()).toEqual([
                'color',
                'content',
                'description',
                'id',
                'members',
                'name',
                'slug',
                'status'
            ]);
            expect(res.body).toEqual(
                expect.objectContaining({
                    name: 'Marketing site',
                    slug: 'marketing-site',
                    description: 'Landing pages and the blog.',
                    color: 'violet',
                    status: 'active'
                })
            );
            // The creator comes from the session, not the body, and is the only
            // member when none are supplied.
            expect(res.body.members).toHaveLength(1);
            expect(res.body.members[0]).toEqual(
                expect.objectContaining({
                    id: user.id,
                    email: ADMIN_EMAIL
                })
            );
            expect(Object.keys(res.body.members[0]).sort()).toEqual([
                'email',
                'id',
                'name'
            ]);
        });

        it('rejects a duplicate slug with 409', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent.post('/api/workspaces').send(validBody()).expect(201);
            await agent.post('/api/workspaces').send(validBody()).expect(409);
        });
    });

    describe('authorization', () => {
        it('rejects an unauthenticated request with 401', async () => {
            await request(harness.server)
                .post('/api/workspaces')
                .send(validBody())
                .expect(401);
        });

        it('forbids a contributor (lacks workspaces:create) with 403', async () => {
            const { agent } = await loginAs(
                'contributor',
                'ws-contributor@example.com'
            );
            await agent.post('/api/workspaces').send(validBody()).expect(403);
        });

        it('forbids a viewer (lacks workspaces:create) with 403', async () => {
            const { agent } = await loginAs('viewer', 'ws-viewer@example.com');
            await agent.post('/api/workspaces').send(validBody()).expect(403);
        });
    });

    describe('validation (400)', () => {
        it('rejects a missing name', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const body = validBody();
            delete body.name;
            await agent.post('/api/workspaces').send(body).expect(400);
        });

        it('rejects a slug with illegal characters', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .post('/api/workspaces')
                .send(validBody({ slug: 'Not A Slug' }))
                .expect(400);
        });

        it('rejects an unknown extra field', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .post('/api/workspaces')
                .send(validBody({ rogue: true }))
                .expect(400);
        });

        it('rejects a missing content block', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            const body = validBody();
            delete body.content;
            await agent.post('/api/workspaces').send(body).expect(400);
        });
    });

    describe('OriginGuard (CSRF)', () => {
        it('rejects a disallowed Origin with 403', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .post('/api/workspaces')
                .set('Origin', 'https://evil.example')
                .send(validBody())
                .expect(403);
        });

        it('allows the configured app origin', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent
                .post('/api/workspaces')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(validBody())
                .expect(201);
        });

        it('allows a request with no Origin (non-browser client)', async () => {
            const { agent } = await loginAs('admin', ADMIN_EMAIL);
            await agent.post('/api/workspaces').send(validBody()).expect(201);
        });
    });
});
