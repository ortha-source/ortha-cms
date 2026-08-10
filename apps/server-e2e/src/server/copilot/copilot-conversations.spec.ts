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
    seedUserWithEmptyRole,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';
import { registerCopilotTools, scriptCopilot } from '../../support/copilot';
import { FixtureToolProvider } from '../../support/copilot-fixture-tools';
import { framesOfType, parseSse } from '../../support/sse';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const OWNER_EMAIL = 'copilot-threads-owner@example.com';
const OTHER_EMAIL = 'copilot-threads-other@example.com';
const NORIGHTS_EMAIL = 'copilot-threads-norights@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * `PATCH /api/copilot/conversations/:id` and the archived half of
 * `GET /api/copilot/conversations` — renaming a thread and filing it away.
 *
 * Archiving is the **only** removal the API offers, and these cases pin why
 * that is safe to expose: it is reversible, it never touches the transcript,
 * and it is scoped to the owner exactly like every other conversation route.
 * There is deliberately no delete — a thread's proposals are the receipts for
 * changes actually made to the caller's content (ADR-0009).
 */
describe('Copilot conversations (PATCH /api/copilot/conversations/:id)', () => {
    let harness: TestApp;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp();
        registerCopilotTools(harness.app, new FixtureToolProvider());
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        workspace = await seedWorkspace({ name: 'Docs', slug: 'docs' });
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Seed an admin, join them to the workspace, and sign them in. */
    async function signIn(email: string, workspaceId = workspace.id) {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role: 'admin'
        });
        await seedMembership(user.id, workspaceId);
        return { user, agent: await login(email) };
    }

    /**
     * Starts a thread by running one turn, and returns its id.
     *
     * Through the run route rather than by inserting a row, so these tests
     * exercise the same conversations the product creates — including the
     * server-derived title a rename is expected to replace.
     */
    async function startThread(
        agent: request.Agent,
        message: string,
        workspaceId = workspace.id
    ): Promise<string> {
        scriptCopilot({ text: 'ok' });
        const response = await agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', workspaceId)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ message })
            .expect(200);
        const [started] = framesOfType(parseSse(response.text), 'run-started');
        expect(started).toBeDefined();
        return started.conversationId;
    }

    /** The caller's threads, active by default. */
    async function list(agent: request.Agent, archived?: boolean) {
        const response = await agent
            .get('/api/copilot/conversations')
            .query(archived === undefined ? {} : { archived: String(archived) })
            .set('X-Workspace-Id', workspace.id)
            .expect(200);
        return response.body.items as { id: string; title: string | null }[];
    }

    function patch(agent: request.Agent, id: string) {
        return agent
            .patch(`/api/copilot/conversations/${id}`)
            .set('X-Workspace-Id', workspace.id)
            .set('Origin', TEST_ALLOWED_ORIGIN);
    }

    // ------------------------------------------------------------- renaming
    describe('renaming', () => {
        it('replaces the derived title', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'how many authors are there?');

            const response = await patch(agent, id)
                .send({ title: 'Author audit' })
                .expect(200);

            expect(response.body.title).toBe('Author audit');
            expect(await list(agent)).toEqual([
                expect.objectContaining({ id, title: 'Author audit' })
            ]);
        });

        it('trims the title, and rejects one that is blank once trimmed', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'hi');

            const ok = await patch(agent, id)
                .send({ title: '  Padded  ' })
                .expect(200);
            expect(ok.body.title).toBe('Padded');

            await patch(agent, id).send({ title: '   ' }).expect(400);
        });

        it('rejects a title past the limit', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'hi');

            await patch(agent, id)
                .send({ title: 'x'.repeat(201) })
                .expect(400);
        });

        it('does not reorder the list — a rename is not a use', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const older = await startThread(agent, 'first');
            const newer = await startThread(agent, 'second');
            expect((await list(agent)).map((row) => row.id)).toEqual([
                newer,
                older
            ]);

            await patch(agent, older).send({ title: 'Renamed' }).expect(200);

            // `updatedAt` means "last used" and the rail sorts by it. Bumping it
            // on a rename would send a thread nobody has spoken to in a week to
            // the top of the list.
            expect((await list(agent)).map((row) => row.id)).toEqual([
                newer,
                older
            ]);
        });
    });

    // ------------------------------------------------------------ archiving
    describe('archiving', () => {
        it('moves the thread between two disjoint lists, reversibly', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'file me away');

            await patch(agent, id).send({ archived: true }).expect(200);
            expect(await list(agent)).toEqual([]);
            expect((await list(agent, true)).map((row) => row.id)).toEqual([
                id
            ]);

            await patch(agent, id).send({ archived: false }).expect(200);
            expect((await list(agent)).map((row) => row.id)).toEqual([id]);
            expect(await list(agent, true)).toEqual([]);
        });

        it('keeps the transcript readable by id', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'still readable');
            await patch(agent, id).send({ archived: true }).expect(200);

            // Archiving hides a thread from a list; it does not revoke a link to
            // it. Anything else would make "archive" a delete with a softer name.
            const response = await agent
                .get(`/api/copilot/conversations/${id}`)
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(response.body.conversation.archived).toBe(true);
            expect(response.body.messages.length).toBeGreaterThan(0);
        });

        it('applies a rename and an archive in one request', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'both at once');

            const response = await patch(agent, id)
                .send({ title: 'Filed', archived: true })
                .expect(200);

            expect(response.body).toEqual(
                expect.objectContaining({ title: 'Filed', archived: true })
            );
        });
    });

    // ----------------------------------------------------------- validation
    describe('validation', () => {
        it('400s an empty patch — it cannot mean anything', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'hi');
            await patch(agent, id).send({}).expect(400);
        });

        it('400s an unknown property', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'hi');
            await patch(agent, id)
                .send({ title: 'fine', deleted: true })
                .expect(400);
        });

        it('400s a non-uuid id, rather than treating it as a miss', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            await patch(agent, 'not-a-uuid').send({ title: 'x' }).expect(400);
        });

        it('rejects `archived` as a bare string', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'hi');
            await patch(agent, id).send({ archived: 'true' }).expect(400);
        });
    });

    // ---------------------------------------------------------------- scope
    describe('scoping', () => {
        it('404s another user’s thread — the id is not probeable', async () => {
            const owner = await signIn(OWNER_EMAIL);
            const id = await startThread(owner.agent, 'private');

            const other = await signIn(OTHER_EMAIL);
            await patch(other.agent, id)
                .send({ title: 'mine now' })
                .expect(404);

            // And it really is untouched.
            const still = await list(owner.agent);
            expect(still[0].title).not.toBe('mine now');
        });

        it('404s a thread from another workspace', async () => {
            const other = await seedWorkspace({ name: 'Other', slug: 'other' });
            const { user, agent } = await signIn(OWNER_EMAIL);
            await seedMembership(user.id, other.id);
            const id = await startThread(agent, 'elsewhere', other.id);

            // Same user, same session — but the header names the workspace the
            // thread does not belong to.
            await patch(agent, id).send({ title: 'moved' }).expect(404);
        });

        it('403s a role without copilot:use', async () => {
            const owner = await signIn(OWNER_EMAIL);
            const id = await startThread(owner.agent, 'hi');

            const user = await seedUserWithEmptyRole(harness.app, {
                email: NORIGHTS_EMAIL,
                password: PASSWORD,
                roleKey: 'copilot-threads-no-perms'
            });
            await seedMembership(user.id, workspace.id);
            const agent = await login(NORIGHTS_EMAIL);

            await patch(agent, id).send({ title: 'nope' }).expect(403);
        });

        it('401s an unauthenticated request', async () => {
            const owner = await signIn(OWNER_EMAIL);
            const id = await startThread(owner.agent, 'hi');

            await request(harness.server)
                .patch(`/api/copilot/conversations/${id}`)
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ title: 'nope' })
                .expect(401);
        });

        it('403s a cross-origin write — `OriginGuard` is on this route', async () => {
            const { agent } = await signIn(OWNER_EMAIL);
            const id = await startThread(agent, 'hi');

            await agent
                .patch(`/api/copilot/conversations/${id}`)
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', 'https://evil.example')
                .send({ title: 'nope' })
                .expect(403);
        });
    });
});
