import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedArticles,
    seedContentGrants,
    seedMediaAsset,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';
import { copilotCalls, scriptCopilot } from '../../support/copilot';
import { framesOfType, parseSse } from '../../support/sse';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const ADMIN_EMAIL = 'proposal-admin@example.com';
const OTHER_ADMIN_EMAIL = 'proposal-admin2@example.com';
const VIEWER_EMAIL = 'proposal-viewer@example.com';
const CONTRIBUTOR_EMAIL = 'proposal-contributor@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The **propose → accept** path (ADR-0005 §5) end to end: a write tool that
 * writes nothing, a `copilot_proposals` row, and an accept that runs the
 * ordinary use-case with the human as actor.
 *
 * The assertions worth their weight are the negative ones. That a proposal
 * *can* be applied is the easy half; that proposing alone changes nothing, that
 * a viewer cannot approve, that accepting twice does not write twice, and that
 * the model is told it must wait — those are the properties the design rests
 * on, and none of them are visible from a happy-path test.
 */
describe('Copilot proposals', () => {
    let harness: TestApp;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        workspace = await seedWorkspace({ name: 'Docs', slug: 'docs' });
        await seedContentGrants(workspace.id, ['test_article']);
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    async function signIn(
        email: string,
        role: 'admin' | 'contributor' | 'viewer'
    ) {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        await seedMembership(user.id, workspace.id);
        return { user, agent: await login(email) };
    }

    async function run(agent: request.Agent, body: Record<string, unknown>) {
        const response = await agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', workspace.id)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send(body)
            .expect(200);
        return parseSse(response.text);
    }

    /** Script one tool call, run it, and return the frames it produced. */
    async function propose(
        agent: request.Agent,
        name: string,
        input: Record<string, unknown>
    ) {
        scriptCopilot(
            { toolCalls: [{ name, input }] },
            { text: 'Drafted for you.' }
        );
        const events = await run(agent, { message: `call ${name}` });
        return {
            result: framesOfType(events, 'tool-result')[0],
            proposal: framesOfType(events, 'proposal')[0]
        };
    }

    /** Read one entry through the API — the check that a write did/didn't land. */
    async function readEntry(agent: request.Agent, id: string) {
        const response = await agent
            .get(`/api/content/test_article/${id}`)
            .set('X-Workspace-Id', workspace.id)
            .expect(200);
        return response.body as { values: Record<string, unknown> };
    }

    // ------------------------------------------------------------- the offer
    describe('the offer', () => {
        it('offers the write tools to an admin', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await run(agent, { message: 'hello' });

            const offered = (copilotCalls()[0].tools ?? []).map((t) => t.name);
            expect(offered).toEqual(
                expect.arrayContaining([
                    'content_propose_create',
                    'content_propose_update',
                    'i18n_propose_translation',
                    'media_propose_alt_text'
                ])
            );
        });

        it('offers a viewer no write tool at all', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(VIEWER_EMAIL, 'viewer');

            await run(agent, { message: 'hello' });

            // ADR-0005's mandatory negative path: a viewer's copilot is
            // *provably* read-only, and this is the assertion that proves it.
            const offered = copilotCalls()[0].tools ?? [];
            expect(
                offered.filter((tool) => tool.name.includes('propose'))
            ).toEqual([]);
        });

        it('offers a contributor the whole write surface, matching the role matrix', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(CONTRIBUTOR_EMAIL, 'contributor');

            await run(agent, { message: 'hello' });

            // `docs/design/copilot.md` §6's matrix: a contributor may draft and
            // edit entries, translate them, and write alt text — they hold
            // `content:create`/`update` and `media:update`. What separates them
            // from an admin is the audit log and configuration, not writes.
            const offered = (copilotCalls()[0].tools ?? []).map((t) => t.name);
            expect(offered).toEqual(
                expect.arrayContaining([
                    'content_propose_create',
                    'content_propose_update',
                    'i18n_propose_translation',
                    'media_propose_alt_text'
                ])
            );
            expect(offered).not.toContain('activity_recent');
        });

        it('exposes no publish tool at any role', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await run(agent, { message: 'hello' });

            // ADR-0005 §7: the copilot may prepare a publishable draft; a
            // person presses publish.
            const offered = (copilotCalls()[0].tools ?? []).map((t) => t.name);
            expect(
                offered.filter((name) => name.toLowerCase().includes('publish'))
            ).toEqual([]);
        });
    });

    // ------------------------------------------------------------- proposing
    describe('proposing changes nothing', () => {
        it('creates a pending proposal and no entry', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result, proposal } = await propose(
                agent,
                'content_propose_create',
                {
                    typeName: 'test_article',
                    values: { text: 'Drafted headline', select: 'article' },
                    summary: 'New article: Drafted headline'
                }
            );

            expect(result.ok).toBe(true);
            expect(proposal).toMatchObject({
                type: 'proposal',
                kind: 'content.entry.create',
                status: 'pending',
                summary: 'New article: Drafted headline'
            });

            // Nothing was written. This is the assertion the whole design rests
            // on: a prompt-injected "just save it" has nowhere to land, because
            // the tool has no write path at all.
            const list = await agent
                .get('/api/content/test_article')
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(list.body.total).toBe(0);
        });

        it('tells the model to wait rather than letting it claim success', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await propose(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: { text: 'Waiting on approval', select: 'article' },
                summary: 'New article'
            });

            // The second model call carries the tool result. A model told only
            // "ok" would happily report the entry as created.
            const followUp = copilotCalls()[1];
            expect(JSON.stringify(followUp.messages)).toContain(
                'Awaiting the user'
            );
        });

        it('carries a before/after diff on an edit', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id,
                    values: { text: 'New headline' },
                    summary: 'Fix the headline'
                }
            );

            expect(proposal.changes).toEqual([
                expect.objectContaining({
                    field: 'text',
                    before: 'Old headline',
                    after: 'New headline'
                })
            ]);
        });

        it('refuses an edit that would change nothing', async () => {
            const [id] = await seedArticles(
                [{ text: 'Unchanged', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result } = await propose(agent, 'content_propose_update', {
                typeName: 'test_article',
                id,
                values: { text: 'Unchanged' },
                summary: 'No-op'
            });

            // A card that proposes nothing wastes a reviewer's attention, and
            // the model needs telling so it stops.
            expect(result.ok).toBe(false);
            expect(result.error).toContain('nothing would change');
        });

        it('refuses a field the type does not declare', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result } = await propose(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: { text: 'Fine', select: 'article', nope: 'invented' },
                summary: 'Bad field'
            });

            // Unlike a read's `fields`, an unknown name here is an error: the
            // cost is a human approving a change they believe writes a field
            // that does not exist.
            expect(result.ok).toBe(false);
            expect(result.error).toContain('nope');
        });

        it('refuses a content type the workspace was not granted', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result } = await propose(agent, 'content_propose_create', {
                typeName: 'test_author',
                values: { name: 'Ada' },
                summary: 'New author'
            });

            expect(result.ok).toBe(false);
            expect(result.error).toContain('Unknown content type');
        });
    });

    // --------------------------------------------------------------- accept
    describe('accepting applies through the ordinary use-case', () => {
        /** Propose an edit and return the proposal id. */
        async function proposeEdit(agent: request.Agent, id: string) {
            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id,
                    values: { text: 'Approved headline' },
                    summary: 'Fix the headline'
                }
            );
            return proposal.id;
        }

        function decide(
            agent: request.Agent,
            proposalId: string,
            decision: 'accept' | 'reject'
        ) {
            return agent
                .post(`/api/copilot/proposals/${proposalId}/${decision}`)
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN);
        }

        it('writes the change and records who decided', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            const response = await decide(agent, proposalId, 'accept').expect(
                200
            );

            expect(response.body).toMatchObject({
                status: 'accepted',
                decidedBy: user.id
            });
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Approved headline'
            );
        });

        it('appends a revision, because it went through the ordinary write', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            await decide(agent, proposalId, 'accept').expect(200);

            // Same validation, same revision, same activity row as a hand-made
            // edit — which is exactly what "run the ordinary use-case" buys.
            const revisions = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(revisions.body.total).toBeGreaterThan(0);
        });

        it('merges rather than replacing the untouched fields', async () => {
            const [id] = await seedArticles(
                [
                    {
                        text: 'Old headline',
                        richtext: 'A body nobody reviewed',
                        select: 'article'
                    }
                ],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            await decide(agent, proposalId, 'accept').expect(200);

            // The admin's PATCH replaces the whole bag because the editor
            // submits the full document; a proposal carries only what a human
            // approved, so replacing would silently null everything they did
            // not see.
            const entry = await readEntry(agent, id);
            expect(entry.values['richtext']).toBe('A body nobody reviewed');
        });

        it('refuses a second accept instead of writing twice', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            await decide(agent, proposalId, 'accept').expect(200);
            // 409, not 200: the client should refresh, not retry.
            await decide(agent, proposalId, 'accept').expect(409);
        });

        it('rejecting writes nothing and closes the proposal', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            const response = await decide(agent, proposalId, 'reject').expect(
                200
            );

            expect(response.body.status).toBe('rejected');
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Old headline'
            );
        });

        it('lets a different member approve a colleague’s proposal', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);
            const { user: other, agent: otherAgent } = await signIn(
                OTHER_ADMIN_EMAIL,
                'admin'
            );

            const response = await decide(
                otherAgent,
                proposalId,
                'accept'
            ).expect(200);

            // A proposal is a review item, not private correspondence. What
            // bounds it is the *approver's* permissions, not authorship.
            expect(response.body.decidedBy).toBe(other.id);
        });

        it('403s a viewer who could not have proposed it', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);
            const { agent: viewerAgent } = await signIn(VIEWER_EMAIL, 'viewer');

            // "You may accept what you could have proposed" — checked by
            // re-resolving the capability profile, so there is no second
            // permission model to keep in step.
            await decide(viewerAgent, proposalId, 'accept').expect(403);
            await decide(viewerAgent, proposalId, 'reject').expect(403);
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Old headline'
            );
        });

        it('403s a cross-site Origin on the accept', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            await agent
                .post(`/api/copilot/proposals/${proposalId}/accept`)
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', 'https://evil.example')
                .expect(403);
        });

        it('404s a proposal from another workspace', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);
            const other = await seedWorkspace({ name: 'Other', slug: 'other' });
            const admin = await seedActiveUser(harness.app, {
                email: 'outsider-admin@example.com',
                password: PASSWORD,
                role: 'admin'
            });
            await seedMembership(admin.id, other.id);
            const otherAgent = await login('outsider-admin@example.com');

            await otherAgent
                .post(`/api/copilot/proposals/${proposalId}/accept`)
                .set('X-Workspace-Id', other.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .expect(404);
        });

        it('422s and stays pending when the apply fails', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const proposalId = await proposeEdit(agent, id);

            // Delete the target between proposing and accepting.
            await agent
                .delete(`/api/content/test_article/${id}`)
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .expect(204);

            await decide(agent, proposalId, 'accept').expect(422);

            // Still pending, with the reason recorded — a failed apply is a
            // proposal that still needs deciding, not a fourth state.
            const after = await agent
                .get(`/api/copilot/proposals/${proposalId}`)
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(after.body.status).toBe('pending');
            expect(after.body.error).toEqual(expect.any(String));
        });
    });

    // ------------------------------------------------------------ the queue
    describe('the review queue', () => {
        it('lists pending proposals for the workspace', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            await propose(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: { text: 'Queued', select: 'article' },
                summary: 'New article'
            });

            const response = await agent
                .get('/api/copilot/proposals')
                .query({ status: 'pending' })
                .set('X-Workspace-Id', workspace.id)
                .expect(200);

            expect(response.body.items).toHaveLength(1);
            expect(response.body.items[0]).toMatchObject({
                toolName: 'content_propose_create',
                status: 'pending'
            });
        });

        it('400s an undeclared query parameter', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            // The host's ValidationPipe runs with `forbidNonWhitelisted`, and
            // the DTO has to declare everything a client may send.
            await agent
                .get('/api/copilot/proposals')
                .query({ status: 'pending', mine: 'true' })
                .set('X-Workspace-Id', workspace.id)
                .expect(400);
        });

        it('does not leak another workspace’s proposals', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            await propose(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: { text: 'Ours', select: 'article' },
                summary: 'New article'
            });
            const other = await seedWorkspace({ name: 'Other', slug: 'other' });
            const admin = await seedActiveUser(harness.app, {
                email: 'queue-outsider@example.com',
                password: PASSWORD,
                role: 'admin'
            });
            await seedMembership(admin.id, other.id);
            const otherAgent = await login('queue-outsider@example.com');

            const response = await otherAgent
                .get('/api/copilot/proposals')
                .set('X-Workspace-Id', other.id)
                .expect(200);

            expect(response.body.items).toEqual([]);
        });
    });

    // ---------------------------------------------------------- auto-apply
    describe('the auto-apply policy', () => {
        function setPolicy(agent: request.Agent, tools: string[]) {
            return agent
                .put('/api/copilot/policy')
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ autoApplyTools: tools });
        }

        it('is closed by default — a workspace with no policy proposes', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const response = await agent
                .get('/api/copilot/policy')
                .set('X-Workspace-Id', workspace.id)
                .expect(200);

            // Enabling the copilot must never silently enable direct writes.
            expect(response.body.autoApplyTools).toEqual([]);
            expect(
                response.body.optInCandidates.map(
                    (tool: { name: string }) => tool.name
                )
            ).toEqual(expect.arrayContaining(['media_propose_alt_text']));
        });

        it('applies immediately once a tool is opted in, and still records the row', async () => {
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');
            const asset = await seedMediaAsset({
                workspaceId: workspace.id,
                uploadedBy: user.id,
                name: 'hero.png',
                kind: 'image',
                mimeType: 'image/png'
            });
            await setPolicy(agent, ['media_propose_alt_text']).expect(200);

            const { proposal } = await propose(
                agent,
                'media_propose_alt_text',
                {
                    assetId: asset.id,
                    alt: 'A cyclist crossing a bridge at dawn',
                    summary: 'Alt text for hero.png'
                }
            );

            // Applied without a click — and still recorded, which is what makes
            // a direct apply "undoable, never invisible".
            expect(proposal.status).toBe('accepted');
            const assets = await agent
                .get('/api/media/assets')
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(assets.body.items[0].alt).toBe(
                'A cyclist crossing a bridge at dawn'
            );
        });

        it('opts in one tool without opening the others', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            await setPolicy(agent, ['media_propose_alt_text']).expect(200);

            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id,
                    values: { text: 'Still needs review' },
                    summary: 'Fix the headline'
                }
            );

            // There is deliberately no `all` switch: one team's judgement about
            // alt text must not become blanket write access.
            expect(proposal.status).toBe('pending');
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Old headline'
            );
        });

        it('drops a tool name nothing binds', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const response = await setPolicy(agent, [
                'media_propose_alt_text',
                'content.deleteEverything'
            ]).expect(200);

            // A stale or mistyped name must not sit in the policy waiting for a
            // future tool to adopt it and inherit an opt-in nobody granted.
            expect(response.body.autoApplyTools).toEqual([
                'media_propose_alt_text'
            ]);
        });

        it('403s an editor without copilot:configure', async () => {
            const { agent } = await signIn(CONTRIBUTOR_EMAIL, 'contributor');

            await agent
                .get('/api/copilot/policy')
                .set('X-Workspace-Id', workspace.id)
                .expect(403);
            await setPolicy(agent, ['media_propose_alt_text']).expect(403);
        });
    });
});
