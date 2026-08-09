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
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';
import { copilotCalls, scriptCopilot } from '../../support/copilot';
import { framesOfType, parseSse } from '../../support/sse';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const ADMIN_EMAIL = 'proposal-admin@example.com';
const VIEWER_EMAIL = 'proposal-viewer@example.com';
const CONTRIBUTOR_EMAIL = 'proposal-contributor@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The **write** path end to end: a `propose` tool that computes a change, the
 * `copilot_proposals` row recording it, and the apply that runs the ordinary
 * use-case with the human as actor.
 *
 * ADR-0009 removed the human step this suite used to be built around. What is
 * gone with it: accept/reject routes, a viewer rubber-stamping a colleague's
 * change, a double-accept, and the per-workspace auto-apply policy. What
 * replaces them is the property that now carries the whole design — **the
 * caller's own permissions are the only gate** — so the assertions that earn
 * their weight are still the negative ones: a viewer is offered no write tool
 * at all, no role is offered publish, an ungranted type is unreachable, and a
 * failed apply is reported as a failure rather than quietly swallowed.
 */
describe('Copilot changes', () => {
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
    describe('a propose tool writes, and records what it wrote', () => {
        it('creates the entry and the row that recorded it', async () => {
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
                status: 'accepted',
                summary: 'New article: Drafted headline'
            });

            // The entry exists — and so does the row saying it was the copilot
            // that made it. The row is written *before* the apply, and since
            // nothing pauses for review it is the only paper trail there is
            // ("undoable, never invisible" with the "never invisible" now
            // resting entirely on this).
            const list = await agent
                .get('/api/content/test_article')
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(list.body.total).toBe(1);
        });

        it('tells the model it saved, so it does not hedge', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await propose(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: { text: 'Saved outright', select: 'article' },
                summary: 'New article'
            });

            // The second model call carries the tool result. The old failure
            // mode was a model claiming success when nothing had been written;
            // the new one is the reverse — hedging about a write that already
            // happened — so the receipt has to say Applied in as many words.
            const followUp = copilotCalls()[1];
            expect(JSON.stringify(followUp.messages)).toContain('Applied');
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

    // ---------------------------------------------------------------- apply
    describe('applying runs the ordinary use-case', () => {
        /** Edit an entry through the copilot and return the proposal frame. */
        async function edit(agent: request.Agent, id: string) {
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
            return proposal;
        }

        it('writes the change and records who made it', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');

            const proposal = await edit(agent, id);

            expect(proposal.status).toBe('accepted');
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Approved headline'
            );
            // The run acts as the user, so the row names them — there is no
            // copilot identity to attribute a change to (ADR-0005 §1).
            const row = await agent
                .get(`/api/copilot/proposals/${proposal.id}`)
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            expect(row.body).toMatchObject({
                status: 'accepted',
                decidedBy: user.id
            });
        });

        it('appends a revision, because it went through the ordinary write', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await edit(agent, id);

            // Same validation, same revision, same activity row as a hand-made
            // edit — which is exactly what "run the ordinary use-case" buys,
            // and the only reason an unreviewed change is recoverable.
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
                        richtext: 'A body nobody asked about',
                        select: 'article'
                    }
                ],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await edit(agent, id);

            // The admin's PATCH replaces the whole bag because the editor
            // submits the full document; a copilot change carries only the
            // fields it named, so replacing would silently null everything the
            // user never mentioned.
            const entry = await readEntry(agent, id);
            expect(entry.values['richtext']).toBe('A body nobody asked about');
        });

        it('reports a failed apply instead of claiming success', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            // `content_propose_update` on a soft-deleted entry: the propose
            // half resolves it from the revision-visible row, the applier's
            // ordinary use-case refuses it.
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            scriptCopilot(
                {
                    toolCalls: [
                        {
                            name: 'content_propose_update',
                            input: {
                                typeName: 'test_article',
                                id: '00000000-0000-4000-8000-000000000000',
                                values: { text: 'Never lands' },
                                summary: 'Edit a ghost'
                            }
                        }
                    ]
                },
                { text: 'That did not work.' }
            );
            const events = await run(agent, { message: 'edit a ghost' });
            const result = framesOfType(events, 'tool-result')[0];

            // The propose half refuses outright here, which is the cheapest
            // failure: nothing is recorded and the model is told why.
            expect(result.ok).toBe(false);
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Old headline'
            );
        });
    });

    // ------------------------------------------------- the removed boundary
    describe('there is no approval boundary any more', () => {
        it('serves no accept or reject route', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const { proposal } = await propose(
                agent,
                'content_propose_create',
                {
                    typeName: 'test_article',
                    values: { text: 'Already saved', select: 'article' },
                    summary: 'New article'
                }
            );

            // A 404 rather than a 405: the routes are gone, not disabled. This
            // is a regression guard — an accept endpoint that quietly came back
            // would let a second apply write the same change twice.
            for (const decision of ['accept', 'reject']) {
                await agent
                    .post(`/api/copilot/proposals/${proposal.id}/${decision}`)
                    .set('X-Workspace-Id', workspace.id)
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .expect(404);
            }
        });

        it('serves no per-workspace policy route', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            // ADR-0009 deleted the policy, its table and `copilot:configure`.
            // An admin is the role that *would* have held the key, so this is
            // the caller that proves the surface is gone rather than forbidden.
            await agent
                .get('/api/copilot/policy')
                .set('X-Workspace-Id', workspace.id)
                .expect(404);
            await agent
                .put('/api/copilot/policy')
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ autoApplyTools: [] })
                .expect(404);
        });
    });

    // ----------------------------------------------------------- the record
    describe('the record of what changed', () => {
        it('lists the workspace’s changes', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            await propose(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: { text: 'Queued', select: 'article' },
                summary: 'New article'
            });

            const response = await agent
                .get('/api/copilot/proposals')
                .query({ status: 'accepted' })
                .set('X-Workspace-Id', workspace.id)
                .expect(200);

            expect(response.body.items).toHaveLength(1);
            expect(response.body.items[0]).toMatchObject({
                toolName: 'content_propose_create',
                status: 'accepted'
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
});
