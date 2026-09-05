import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    getActivityRows,
    resetDb,
    seedActiveUser,
    seedArticles,
    seedContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';
import { drainOutbox } from '../../support/outbox';
import { copilotCalls, scriptCopilot } from '../../support/copilot';
import { framesOfType, parseSse, streamSse } from '../../support/sse';
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

    /** Answer one parked call. Fire-and-forget: the run is awaiting this. */
    function decide(
        agent: request.Agent,
        runId: string,
        callId: string,
        decision: 'once' | 'chat' | 'deny'
    ): void {
        void agent
            .post(`/api/copilot/runs/${runId}/permission`)
            .set('X-Workspace-Id', workspace.id)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ callId, decision })
            .expect(204)
            .catch((error: Error) => {
                // Surfacing this matters: a swallowed failure here reads as the
                // five-minute broker timeout, i.e. a 30s Jest timeout with no
                // hint of why.
                throw new Error(`answering ${callId} failed: ${error.message}`);
            });
    }

    /**
     * Start a run and answer every write prompt it parks on.
     *
     * ADR-0009 §1b: a `propose`/`apply` call the thread has not already allowed
     * suspends the run until `POST /runs/:runId/permission` resolves it. So the
     * answer must be sent *mid-stream* — hence {@link streamSse} rather than the
     * buffered `run` above, which would deadlock waiting for a body that cannot
     * finish until it is answered.
     */
    async function runAnswering(
        agent: request.Agent,
        body: Record<string, unknown>,
        decision: 'once' | 'chat' | 'deny' = 'once'
    ) {
        const request$ = agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', workspace.id)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send(body)
            .expect(200);
        return streamSse(request$, (event) => {
            if (event.type === 'tool-permission-request') {
                decide(agent, event.runId, event.id, decision);
            }
        });
    }

    /** Script one tool call, allow it, and return the frames it produced. */
    async function propose(
        agent: request.Agent,
        name: string,
        input: Record<string, unknown>,
        decision: 'once' | 'chat' | 'deny' = 'once'
    ) {
        scriptCopilot(
            { toolCalls: [{ name, input }] },
            { text: 'Drafted for you.' }
        );
        const events = await runAnswering(
            agent,
            { message: `call ${name}` },
            decision
        );
        return {
            events,
            result: framesOfType(events, 'tool-result')[0],
            proposal: framesOfType(events, 'proposal')[0],
            permission: framesOfType(events, 'tool-permission-request')[0]
        };
    }

    /** The whole paper trail for the workspace, whatever each row's status. */
    async function proposalRows(agent: request.Agent) {
        const response = await agent
            .get('/api/copilot/proposals')
            .set('X-Workspace-Id', workspace.id)
            .expect(200);
        return response.body.items as { toolName: string; status: string }[];
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
                    'i18n_propose_bulk_translation',
                    'media_propose_alt_text',
                    'media_propose_file'
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
                    'i18n_propose_bulk_translation',
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

    // ------------------------------------------------------- asking first
    //
    // ADR-0009 §1b. The prompt is what buys back the defence the rest of that
    // record gives up: the injected call parks and shows its arguments before
    // anything happens. Untested, it is also *invisible* — a run that silently
    // stopped asking would look exactly like these suites passing.
    describe('a write asks before it runs', () => {
        it('parks the call and shows the user its arguments [copilot:I-07]', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { permission, result, events } = await propose(
                agent,
                'content_propose_create',
                {
                    typeName: 'test_article',
                    values: { text: 'Asked first' },
                    summary: 'Draft it'
                }
            );

            expect(permission).toBeDefined();
            expect(permission.name).toBe('content_propose_create');
            // The arguments ride the frame, because approving a write you
            // cannot see is the ceremony ADR-0009 deleted, not the one it kept.
            expect(permission.input).toMatchObject({
                typeName: 'test_article'
            });
            // …and it is asked *before* the call runs, not alongside it.
            expect(events.indexOf(permission)).toBeLessThan(
                events.indexOf(result)
            );
            expect(result.ok).toBe(true);
        });

        it('never asks about a read [copilot:I-07]', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            scriptCopilot(
                {
                    toolCalls: [
                        {
                            name: 'admin_content_search',
                            input: { typeName: 'test_article' }
                        }
                    ]
                },
                { text: 'Found them.' }
            );

            const events = await runAnswering(agent, { message: 'search' });

            // A model runs three or four reads before it answers anything; a
            // chat that opens with four prompts teaches people to click
            // through them without reading.
            expect(framesOfType(events, 'tool-permission-request')).toEqual([]);
            expect(framesOfType(events, 'tool-result')[0].ok).toBe(true);
        });

        it('refuses the call when the user says no, and writes nothing', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result } = await propose(
                agent,
                'content_propose_create',
                {
                    typeName: 'test_article',
                    values: { text: 'Refused' },
                    summary: 'Draft it'
                },
                'deny'
            );

            // A refusal is an ordinary tool error, so the model reports it and
            // the run carries on rather than dying.
            expect(result.ok).toBe(false);
            expect(result.error).toContain('did not allow');
            expect(await proposalRows(agent)).toHaveLength(0);
        });

        it('stops asking for the rest of the chat once allowed for it [copilot:I-08]', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            scriptCopilot(
                {
                    toolCalls: [
                        {
                            name: 'content_propose_create',
                            input: {
                                typeName: 'test_article',
                                values: { text: 'First' },
                                summary: 'One'
                            }
                        },
                        {
                            name: 'content_propose_create',
                            input: {
                                typeName: 'test_article',
                                values: { text: 'Second' },
                                summary: 'Two'
                            }
                        }
                    ]
                },
                { text: 'Both drafted.' }
            );

            const events = await runAnswering(
                agent,
                { message: 'draft two' },
                'chat'
            );

            // The allow-list is read per call rather than per run, so the
            // answer to the first stops the second in the *same* turn asking.
            expect(
                framesOfType(events, 'tool-permission-request')
            ).toHaveLength(1);
            expect(
                framesOfType(events, 'tool-result').map((frame) => frame.ok)
            ).toEqual([true, true]);
            expect(await proposalRows(agent)).toHaveLength(2);
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

        it('refuses a content type the workspace was not granted [content:I-33]', async () => {
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

    // ------------------------------------------------- the blast radius
    /**
     * A localized type stores one row per language, and a field it does not
     * mark `localized` is **shared** — so writing one propagates to every
     * sibling in the translation group. `i18n_propose_translation` refuses
     * shared fields outright; the content tools cannot, because they are the
     * only way to edit one at all.
     *
     * What they owe instead is disclosure. Under ADR-0009 the change applies
     * the moment it is drafted, so the proposal's summary is the only place a
     * person learns that one accepted edit moved their content in four
     * languages — and it used to read as an ordinary single-entry edit.
     */
    describe('a change that reaches other locales says so', () => {
        /** Seed one record as two locale rows of a single translation group. */
        async function seedTranslated(
            values: Record<string, unknown>
        ): Promise<{ en: string; de: string }> {
            const localeGroupId = randomUUID();
            const [en, de] = await seedArticles(
                [
                    { ...values, locale: 'en', localeGroupId },
                    { ...values, locale: 'de', localeGroupId }
                ],
                workspace.id
            );
            return { en, de };
        }

        it('names the sibling locales and the shared field on an edit [content:I-32]', async () => {
            const { en } = await seedTranslated({
                text: 'Headline',
                select: 'article'
            });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id: en,
                    // `select` is not marked `localized`, so it is the record's
                    // category in every language.
                    values: { select: 'tutorial' },
                    summary: 'Recategorise the article'
                }
            );

            expect(proposal.summary).toContain('Recategorise the article');
            expect(proposal.summary).toContain('de');
            expect(proposal.summary).toContain('select');
            expect(proposal.summary).toContain('shared across locales');
            // Structured beside the prose: "which changes reached more than the
            // row they named" is a question an audit asks of the table.
            expect(proposal.target).toMatchObject({
                fanout: { fields: ['select'], locales: ['de'] }
            });
        });

        it('says nothing when the edit touches only localized fields', async () => {
            const { en } = await seedTranslated({
                text: 'Headline',
                select: 'article'
            });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id: en,
                    values: { text: 'Better headline' },
                    summary: 'Fix the headline'
                }
            );

            // This is what a translation *is*, and it is the common case. A
            // caveat on every edit teaches the reader to skim past it on the
            // one that matters.
            expect(proposal.summary).toBe('Fix the headline');
            expect(proposal.target).not.toHaveProperty('fanout');
        });

        it('says nothing when the record has no other locales', async () => {
            const [id] = await seedArticles(
                [{ text: 'Alone', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id,
                    values: { select: 'tutorial' },
                    summary: 'Recategorise the article'
                }
            );

            expect(proposal.summary).toBe('Recategorise the article');
            expect(proposal.target).not.toHaveProperty('fanout');
        });

        it('the disclosure is true — the sibling really is rewritten', async () => {
            const { en, de } = await seedTranslated({
                text: 'Headline',
                select: 'article'
            });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { proposal } = await propose(
                agent,
                'content_propose_update',
                {
                    typeName: 'test_article',
                    id: en,
                    values: { select: 'changelog' },
                    summary: 'Recategorise'
                }
            );
            expect(proposal.status).toBe('accepted');

            // The whole point: the card named `de`, and the German row moved.
            // If this assertion ever fails the disclosure has become a lie,
            // which is worse than not having made it.
            const sibling = await readEntry(agent, de);
            expect(sibling.values['select']).toBe('changelog');
        });

        it('merges the disclosure across a batch, and counts the records', async () => {
            const first = await seedTranslated({
                text: 'One',
                select: 'article'
            });
            const second = await seedTranslated({
                text: 'Two',
                select: 'article'
            });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { proposal } = await propose(
                agent,
                'content_propose_bulk_save',
                {
                    typeName: 'test_article',
                    items: [
                        { id: first.en, values: { select: 'tutorial' } },
                        { id: second.en, values: { number: 7 } }
                    ],
                    summary: 'Tidy up two articles'
                }
            );

            // "Translate these eight posts" is the instruction this tool exists
            // for, and the one most likely to reach a shared field — so a
            // single accepted card could rewrite eight records in every
            // language they have.
            expect(proposal.summary).toContain('2 of these records');
            expect(proposal.summary).toContain('de');
            expect(proposal.target).toMatchObject({
                fanout: { fields: ['number', 'select'], locales: ['de'] }
            });
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

        it('writes the change and records who made it [copilot:I-01]', async () => {
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

        it('appends a revision, because it went through the ordinary write [content:I-30] [copilot:I-13]', async () => {
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

        /**
         * The third of the invariant's three claims, and the one that decides
         * whether the audit log can be read at all: **the same activity row**.
         *
         * The revision case above proves the write went through the ordinary
         * use-case. It says nothing about who the journal names for it, and
         * that is the half worth asserting — an applier stamping a machine
         * identity leaves every other assertion in this file green while the
         * question an audit trail exists to answer stops having an answer.
         *
         * `via` is the counterpart: with a change applying the moment it is
         * drafted (ADR-0009), a row attributed to Ada with nothing else on it
         * cannot distinguish "Ada edited this" from "Ada asked the agent to".
         */
        it('journals the change under the person who asked for it [copilot:I-13]', async () => {
            const [id] = await seedArticles(
                [{ text: 'Old headline', select: 'article' }],
                workspace.id
            );
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');

            await edit(agent, id);
            // The audit row is raised through the outbox, so it exists only
            // once the dispatcher has run.
            await drainOutbox(harness.app);

            const rows = (await getActivityRows()).filter(
                (row) => row.subjectId === id
            );
            expect(rows.length).toBeGreaterThan(0);
            for (const row of rows) {
                expect(row.actorId).toBe(user.id);
                expect(row.actorEmail).toBe(ADMIN_EMAIL);
            }
            expect(
                rows.some(
                    (row) =>
                        (
                            row.meta as {
                                via?: { kind?: string };
                            } | null
                        )?.via?.kind === 'copilot'
                )
            ).toBe(true);
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
            const events = await runAnswering(agent, {
                message: 'edit a ghost'
            });
            const result = framesOfType(events, 'tool-result')[0];

            // The propose half refuses outright here, which is the cheapest
            // failure: nothing is recorded and the model is told why.
            expect(result.ok).toBe(false);
            expect((await readEntry(agent, id)).values['text']).toBe(
                'Old headline'
            );
        });
    });

    // ------------------------------------------------- batch translations
    //
    // The batch a model reaches for on "translate this into German and French".
    // What it must NOT be is `content_propose_bulk_save` with a
    // `localeGroupId`: a create is a whole row, so every shared field the batch
    // did not name arrives as null and the i18n sync pushes those nulls over
    // the group — which is why the content tools no longer offer that argument
    // and this is the only route in.
    describe('a batch translation is one change', () => {
        /** The group's rows, keyed by locale, straight from the locale panel. */
        async function localesOf(agent: request.Agent, id: string) {
            const response = await agent
                .get(`/api/i18n/content/test_article/${id}/locales`)
                .set('X-Workspace-Id', workspace.id)
                .expect(200);
            const items = response.body.items as {
                locale: string;
                entry: { id: string } | null;
            }[];
            return new Map(items.map((item) => [item.locale, item.entry]));
        }

        it('writes every locale, carrying the shared values over [i18n:I-28]', async () => {
            const [id] = await seedArticles(
                [{ text: 'English headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result, proposal } = await propose(
                agent,
                'i18n_propose_bulk_translation',
                {
                    typeName: 'test_article',
                    summary: 'Translate into German and French',
                    items: [
                        {
                            id,
                            locale: 'de',
                            values: { text: 'Deutsche Überschrift' }
                        },
                        {
                            id,
                            locale: 'fr',
                            values: { text: 'Titre français' }
                        }
                    ]
                }
            );

            expect(result.ok).toBe(true);
            // One row for the whole batch: a proposal is the receipt for one
            // tool call, and three cards for one instruction is what this tool
            // exists to stop.
            expect(proposal.kind).toBe('i18n.entry.bulk-translate');
            expect(await proposalRows(agent)).toHaveLength(1);

            const rows = await localesOf(agent, id);
            const de = rows.get('de');
            const fr = rows.get('fr');
            expect(de).not.toBeNull();
            expect(fr).not.toBeNull();

            // `select` is required AND shared, so no translation ever carries
            // it: the applier seeds each create from the source row. Without
            // that the write fails its own required check — and where it
            // doesn't, the null is synced over the whole group.
            const german = await readEntry(agent, (de as { id: string }).id);
            expect(german.values['text']).toBe('Deutsche Überschrift');
            expect(german.values['select']).toBe('article');
            // …and the language it was translated from is untouched.
            const english = await readEntry(agent, id);
            expect(english.values['text']).toBe('English headline');
            expect(english.values['select']).toBe('article');
        });

        it('stops at the first failure and says how many landed [i18n:I-29]', async () => {
            const [id] = await seedArticles(
                [{ text: 'English headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            // The second item names a `heroImage` asset that does not exist —
            // a localized field, so it passes the offer-time checks, and a
            // media target the writer refuses (422) before it inserts. Field
            // *rules* would not do: `test_article` is publishable, so
            // `EntryWriterService` defers required/length/format validation to
            // publish time and a two-character `text` would save happily.
            const { result, proposal } = await propose(
                agent,
                'i18n_propose_bulk_translation',
                {
                    typeName: 'test_article',
                    summary: 'One good, one bad',
                    items: [
                        {
                            id,
                            locale: 'de',
                            values: { text: 'Deutsche Überschrift' }
                        },
                        {
                            id,
                            locale: 'fr',
                            values: {
                                text: 'Titre français',
                                heroImage:
                                    '00000000-0000-4000-8000-0000000000ff'
                            }
                        }
                    ]
                }
            );

            expect(result.ok).toBe(false);
            // A proposal has one status and one card, so there is no per-item
            // verdict to render — the message is what the model reads back,
            // and "nothing was saved" would be a lie about the German row.
            //
            // It rides on `output.applyError`, not on `error`. The two are
            // different failures: `error` is a tool that refused or threw
            // before there was a proposal, while a proposal whose APPLY failed
            // has a row, a status and a card, and its reason travels with them
            // (the `proposal` frame carries the same string, which is what the
            // card renders). This asserted `error` and therefore asserted
            // `undefined` contains a string.
            const applyError = (
                result.output as { applyError?: string } | undefined
            )?.applyError;
            expect(applyError).toContain('Translation 2 of 2 (fr) failed');
            expect(applyError).toContain('The first 1 were saved');
            expect(proposal.error).toBe(applyError);

            const rows = await localesOf(agent, id);
            expect(rows.get('de')).not.toBeNull();
            expect(rows.get('fr')).toBeNull();
        });

        it('refuses a locale the record already has, before writing anything', async () => {
            const [id] = await seedArticles(
                [{ text: 'English headline', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const { result } = await propose(
                agent,
                'i18n_propose_bulk_translation',
                {
                    typeName: 'test_article',
                    summary: 'A duplicate and a good one',
                    items: [
                        { id, locale: 'de', values: { text: 'Deutsch' } },
                        { id, locale: 'en', values: { text: 'English again' } }
                    ]
                }
            );

            // The offer-time checks run over the whole batch first, so a
            // duplicate `(group, locale)` — a 409 at write time — costs the
            // good item nothing: neither is written.
            expect(result.ok).toBe(false);
            expect(result.error).toContain('already has a "en" translation');
            expect(await proposalRows(agent)).toHaveLength(0);
            const rows = await localesOf(agent, id);
            expect(rows.get('de')).toBeNull();
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
