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
    seedMediaFolder,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';
import { copilotCalls, scriptCopilot } from '../../support/copilot';
import { framesOfType, parseSse } from '../../support/sse';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const ADMIN_EMAIL = 'catalogue-admin@example.com';
const VIEWER_EMAIL = 'catalogue-viewer@example.com';
const CONTRIBUTOR_EMAIL = 'catalogue-contributor@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The copilot's **read catalogue** beyond the three entry tools: version
 * history, locales, media, the audit log and the workspace directory.
 *
 * Each one is bound by the plugin that owns the data (`revisions` and
 * `diffRevisions` by content, `listLocales` by i18n, and so on), which makes
 * the *registration* worth an end-to-end test on its own: a binder wires itself
 * up from `OnApplicationBootstrap` against an optionally-injected registry, so
 * a mis-wired one produces a copilot silently missing that plugin's tools and
 * no error anywhere. `offers every read tool in the catalogue` is the test that
 * would catch it.
 *
 * A separate file from `copilot-chat.spec.ts` on purpose: that suite is about
 * the run — guards, the pipe, the stream, the loop — and this one is about what
 * the run can reach.
 */
describe('Copilot read catalogue', () => {
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

    /** Seed a user of `role`, join them to the workspace, and sign them in. */
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

    /** Start a run and return its parsed frames. */
    async function run(agent: request.Agent, body: Record<string, unknown>) {
        const response = await agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', workspace.id)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send(body)
            .expect(200);
        return parseSse(response.text);
    }

    /** Script one tool call, run it, and return the single tool-result frame. */
    async function callTool(
        agent: request.Agent,
        name: string,
        input: Record<string, unknown> = {}
    ) {
        scriptCopilot({ toolCalls: [{ name, input }] }, { text: 'done' });
        const events = await run(agent, { message: `call ${name}` });
        return framesOfType(events, 'tool-result')[0];
    }

    // ------------------------------------------------------------- the offer
    describe('the offer', () => {
        it('offers every read tool in the catalogue to an admin', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            await run(agent, { message: 'hello' });

            const offered = (copilotCalls()[0].tools ?? []).map((t) => t.name);
            expect(offered).toEqual(
                expect.arrayContaining([
                    'content.listTypes',
                    'content.searchEntries',
                    'content.getEntry',
                    'content.listRevisions',
                    'content.diffRevisions',
                    'i18n.listLocales',
                    'i18n.getTranslations',
                    'media.searchAssets',
                    'activity.recent',
                    'workspace.members'
                ])
            );
        });

        it('withholds the audit log from a contributor, who lacks activity:read', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(CONTRIBUTOR_EMAIL, 'contributor');

            await run(agent, { message: 'hello' });

            const offered = (copilotCalls()[0].tools ?? []).map((t) => t.name);
            // Withheld at *offer* time, so the model is never told it exists —
            // ADR-0005 §3's first enforcement point, which is not an
            // optimisation.
            expect(offered).not.toContain('activity.recent');
            // …while the rest of the read catalogue is untouched: this is a
            // permission gate, not a role-shaped allowlist.
            expect(offered).toEqual(
                expect.arrayContaining([
                    'media.searchAssets',
                    'workspace.members',
                    'content.listRevisions'
                ])
            );
        });

        it('offers a viewer the whole read catalogue except the audit log', async () => {
            scriptCopilot({ text: 'ok' });
            const { agent } = await signIn(VIEWER_EMAIL, 'viewer');

            await run(agent, { message: 'hello' });

            const offered = (copilotCalls()[0].tools ?? []).map((t) => t.name);
            expect(offered).not.toContain('activity.recent');
            expect(offered).toEqual(
                expect.arrayContaining([
                    'content.listRevisions',
                    'i18n.listLocales',
                    'media.searchAssets',
                    'workspace.members'
                ])
            );
            // Every offered tool reads. A viewer's copilot being provably
            // read-only is ADR-0005's mandatory negative path.
            expect(
                (copilotCalls()[0].tools ?? []).every(
                    (tool) => !tool.name.includes('propose')
                )
            ).toBe(true);
        });
    });

    // ------------------------------------------------------------- revisions
    describe('content.listRevisions / content.diffRevisions', () => {
        /** Create an entry through the API, then edit it — two versions. */
        async function entryWithTwoVersions(agent: request.Agent) {
            const created = await agent
                .post('/api/content/test_article')
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ values: { text: 'First draft', select: 'article' } })
                .expect(201);
            const id = created.body.id as string;
            await agent
                .patch(`/api/content/test_article/${id}`)
                .set('X-Workspace-Id', workspace.id)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ values: { text: 'Second draft', select: 'tutorial' } })
                .expect(200);
            return id;
        }

        it('lists an entry’s versions, newest first', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const id = await entryWithTwoVersions(agent);

            const result = await callTool(agent, 'content.listRevisions', {
                typeName: 'test_article',
                id
            });

            expect(result.ok).toBe(true);
            const output = result.output as {
                total: number;
                items: { number: number }[];
            };
            expect(output.total).toBe(2);
            expect(output.items.map((item) => item.number)).toEqual([2, 1]);
        });

        it('reports only the fields that changed between two versions', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const id = await entryWithTwoVersions(agent);

            const result = await callTool(agent, 'content.diffRevisions', {
                typeName: 'test_article',
                id,
                from: 1,
                to: 2
            });

            expect(result.ok).toBe(true);
            const output = result.output as {
                changes: { field: string; from: unknown; to: unknown }[];
                unchangedFields: number;
            };
            expect(output.changes.map((change) => change.field).sort()).toEqual(
                ['select', 'text']
            );
            expect(
                output.changes.find((change) => change.field === 'text')
            ).toMatchObject({ from: 'First draft', to: 'Second draft' });
            // The rest of a wide type is summarised as a count rather than
            // spent as prompt tokens.
            expect(output.unchangedFields).toBeGreaterThan(0);
        });

        it('names the missing version rather than failing opaquely', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            const id = await entryWithTwoVersions(agent);

            const result = await callTool(agent, 'content.diffRevisions', {
                typeName: 'test_article',
                id,
                from: 1,
                to: 9
            });

            expect(result.ok).toBe(false);
            expect(result.error).toContain('9');
        });

        it('refuses a content type the workspace was not granted', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const result = await callTool(agent, 'content.listRevisions', {
                typeName: 'test_author',
                id: '00000000-0000-0000-0000-000000000000'
            });

            expect(result.ok).toBe(false);
            expect(result.error).toContain('Unknown content type');
        });
    });

    // ------------------------------------------------------------------ i18n
    describe('i18n.listLocales / i18n.getTranslations', () => {
        it('lists the configured locales, marking the default', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const result = await callTool(agent, 'i18n.listLocales');

            expect(result.ok).toBe(true);
            const output = result.output as {
                locales: { slug: string; isDefault?: boolean }[];
            };
            expect(output.locales.map((locale) => locale.slug)).toContain('en');
            expect(
                output.locales.filter((locale) => locale.isDefault)
            ).toHaveLength(1);
        });

        it('reports which locales an entry has been translated into', async () => {
            const [id] = await seedArticles(
                [{ text: 'English only', select: 'article' }],
                workspace.id
            );
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const result = await callTool(agent, 'i18n.getTranslations', {
                typeName: 'test_article',
                id
            });

            expect(result.ok).toBe(true);
            const output = result.output as {
                items: { locale: string; entry: { id: string } | null }[];
            };
            // One item per *configured* locale, so a missing translation is
            // visible as `entry: null` rather than as an absent key.
            expect(
                output.items.find((item) => item.locale === 'en')?.entry?.id
            ).toBe(id);
            expect(output.items.some((item) => item.entry === null)).toBe(true);
        });

        it('says a type is not localized rather than answering “no translations”', async () => {
            await seedContentGrants(workspace.id, ['test_tag']);
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const result = await callTool(agent, 'i18n.getTranslations', {
                typeName: 'test_tag',
                id: '00000000-0000-0000-0000-000000000000'
            });

            expect(result.ok).toBe(false);
            expect(result.error).toContain('not localized');
        });

        it('refuses a content type the workspace was not granted', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');

            const result = await callTool(agent, 'i18n.getTranslations', {
                typeName: 'test_author',
                id: '00000000-0000-0000-0000-000000000000'
            });

            expect(result.ok).toBe(false);
            expect(result.error).toContain('Unknown content type');
        });
    });

    // ----------------------------------------------------------------- media
    describe('media.searchAssets', () => {
        it('searches every folder, not just the workspace root', async () => {
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');
            const folder = await seedMediaFolder({
                workspaceId: workspace.id,
                name: 'Brand'
            });
            await seedMediaAsset({
                workspaceId: workspace.id,
                uploadedBy: user.id,
                name: 'logo.png',
                kind: 'image',
                mimeType: 'image/png',
                folderId: folder.id
            });

            const result = await callTool(agent, 'media.searchAssets', {
                search: 'logo'
            });

            expect(result.ok).toBe(true);
            const output = result.output as {
                total: number;
                items: { name: string; kind: string }[];
            };
            // The admin's library browses one folder at a time and would find
            // nothing here; a model has no idea which folder to look in.
            expect(output.total).toBe(1);
            expect(output.items[0]).toMatchObject({
                name: 'logo.png',
                kind: 'image'
            });
        });

        it('filters by kind', async () => {
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');
            await seedMediaAsset({
                workspaceId: workspace.id,
                uploadedBy: user.id,
                name: 'cover.png',
                kind: 'image',
                mimeType: 'image/png'
            });
            await seedMediaAsset({
                workspaceId: workspace.id,
                uploadedBy: user.id,
                name: 'terms.pdf',
                kind: 'document'
            });

            const result = await callTool(agent, 'media.searchAssets', {
                kind: 'image'
            });

            const output = result.output as { items: { name: string }[] };
            expect(output.items.map((item) => item.name)).toEqual([
                'cover.png'
            ]);
        });

        it('does not see another workspace’s assets', async () => {
            const other = await seedWorkspace({ name: 'Other', slug: 'other' });
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');
            await seedMediaAsset({
                workspaceId: other.id,
                uploadedBy: user.id,
                name: 'secret.pdf'
            });

            const result = await callTool(agent, 'media.searchAssets', {});

            expect((result.output as { total: number }).total).toBe(0);
        });

        it('omits the storage URL, which a model cannot fetch anyway', async () => {
            const { user, agent } = await signIn(ADMIN_EMAIL, 'admin');
            await seedMediaAsset({
                workspaceId: workspace.id,
                uploadedBy: user.id,
                name: 'cover.png',
                kind: 'image',
                mimeType: 'image/png'
            });

            const result = await callTool(agent, 'media.searchAssets', {});

            const item = (result.output as { items: Record<string, unknown>[] })
                .items[0];
            // `url` is a session-gated route, so it answers nothing and costs
            // prompt tokens; `id` is what makes an asset referenceable.
            expect(item).not.toHaveProperty('url');
            expect(item).not.toHaveProperty('variants');
            expect(item.id).toEqual(expect.any(String));
        });
    });

    // -------------------------------------------------------------- activity
    describe('activity.recent', () => {
        it('reads the audit trail for an admin', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            // Inviting a member is an audited action, so this produces a real
            // row through the real subscriber rather than a hand-seeded one.
            await agent
                .post('/api/users/invites')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: 'invited@example.com', role: 'viewer' })
                .expect(201);

            const result = await callTool(agent, 'activity.recent', {});

            expect(result.ok).toBe(true);
            const output = result.output as {
                total: number;
                items: { kind: string; at: string }[];
            };
            expect(output.total).toBeGreaterThan(0);
            // Serialized as an ISO string, not a `Date` — the tool result is
            // JSON on its way into a prompt.
            expect(output.items[0].at).toEqual(expect.any(String));
        });

        it('is not callable by a contributor even if the model names it', async () => {
            const { agent } = await signIn(CONTRIBUTOR_EMAIL, 'contributor');

            const result = await callTool(agent, 'activity.recent', {});

            // The second enforcement point: authorize at execution, against a
            // freshly resolved session. A withheld tool and an unknown one get
            // the same message, because "that exists but you may not use it"
            // is itself information.
            expect(result.ok).toBe(false);
        });
    });

    // ------------------------------------------------------------- workspace
    describe('workspace.members', () => {
        it('lists this workspace’s members with their roles', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            await signIn(VIEWER_EMAIL, 'viewer');

            const result = await callTool(agent, 'workspace.members');

            expect(result.ok).toBe(true);
            const output = result.output as {
                total: number;
                items: { email: string; roleKey: string }[];
            };
            expect(output.total).toBe(2);
            expect(output.items.map((item) => item.email).sort()).toEqual(
                [ADMIN_EMAIL, VIEWER_EMAIL].sort()
            );
            expect(
                output.items.find((item) => item.email === VIEWER_EMAIL)
                    ?.roleKey
            ).toBe('viewer');
        });

        it('does not list accounts that are not members of this workspace', async () => {
            const { agent } = await signIn(ADMIN_EMAIL, 'admin');
            // Seeded with no membership — an account in the deployment, but
            // not on this team. `users:read` alone would have listed them.
            await seedActiveUser(harness.app, {
                email: 'outsider@example.com',
                password: PASSWORD,
                role: 'admin'
            });

            const result = await callTool(agent, 'workspace.members');

            const output = result.output as { items: { email: string }[] };
            expect(output.items.map((item) => item.email)).toEqual([
                ADMIN_EMAIL
            ]);
        });
    });
});
