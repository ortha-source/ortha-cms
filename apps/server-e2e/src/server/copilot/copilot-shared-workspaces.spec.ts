import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedMembership,
    seedTags,
    seedWorkspace
} from '../../support/seed';
import { scriptCopilot } from '../../support/copilot';
import { framesOfType, streamSse } from '../../support/sse';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const ADMIN_EMAIL = 'copilot-shared-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** Published-now columns for a seeded row. */
const PUBLISHED = { status: 'published', publishedAt: new Date() } as const;

/** One entry as the copilot's admin tools return it. */
interface Entry {
    id: string;
    values: Record<string, unknown>;
    source?: { workspaceId: string; workspaceName: string } | null;
    readOnly?: boolean;
}

/**
 * **Shared workspaces** (ADR-0019) through the copilot's content tools, driven
 * by the scripted fake model.
 *
 * The copilot reads through the admin services rather than the public API, so
 * it is a second path to the same rule — `admin_content_search`'s `source`,
 * `admin_content_get`'s `readOnly`, and every propose tool refusing a visible
 * library record with a message that says to link it. The negative half pins
 * that a draft, an unshared workspace's record and an unknown id keep the plain
 * not-found: a clearer message for an id the caller cannot see would be an
 * enumeration signal.
 */
describe('Copilot content tools — shared workspaces', () => {
    let harness: TestApp;
    let consumerId: string;
    let sharedId: string;
    let sharedTag: string;
    let sharedDraftTag: string;
    let privateTag: string;
    let ownTag: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        consumerId = (
            await seedWorkspace({ name: 'Consumer', slug: 'consumer' })
        ).id;
        sharedId = (
            await seedWorkspace({
                name: 'Brand library',
                slug: 'brand-library',
                isShared: true
            })
        ).id;
        const privateId = (
            await seedWorkspace({ name: 'Private', slug: 'private' })
        ).id;
        for (const id of [consumerId, sharedId, privateId]) {
            await seedAllContentGrants(id);
        }
        [sharedTag, sharedDraftTag] = await seedTags(
            [{ name: 'Shared Design', ...PUBLISHED }, { name: 'Shared Draft' }],
            sharedId
        );
        [privateTag] = await seedTags(
            [{ name: 'Private Design', ...PUBLISHED }],
            privateId
        );
        [ownTag] = await seedTags(
            [{ name: 'Own Design', ...PUBLISHED }],
            consumerId
        );
    });

    async function signIn() {
        const user = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        await seedMembership(user.id, consumerId);
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /**
     * Script one tool call, allow it if it asks (a write parks on a
     * permission prompt, ADR-0009 §1b), and return its tool-result frame.
     */
    async function callTool(
        agent: request.Agent,
        name: string,
        input: Record<string, unknown>
    ) {
        scriptCopilot({ toolCalls: [{ name, input }] }, { text: 'done' });
        const request$ = agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', consumerId)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ message: `call ${name}` })
            .expect(200);
        const events = await streamSse(request$, (event) => {
            if (event.type === 'tool-permission-request') {
                void agent
                    .post(`/api/copilot/runs/${event.runId}/permission`)
                    .set('X-Workspace-Id', consumerId)
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ callId: event.id, decision: 'once' })
                    .expect(204)
                    .catch((error: Error) => {
                        throw new Error(
                            `answering ${event.id} failed: ${error.message}`
                        );
                    });
            }
        });
        return framesOfType(events, 'tool-result')[0];
    }

    /** Ids of a search result's items, sorted. */
    function ids(output: unknown): string[] {
        return ((output as { items: Entry[] }).items ?? [])
            .map((item) => item.id)
            .sort();
    }

    /** The read-only refusal every write tool gives a visible foreign id. */
    function expectReadOnly(result: { ok: boolean; error?: string }) {
        expect(result.ok).toBe(false);
        expect(result.error).toContain('shared workspace "Brand library"');
        expect(result.error).toContain('read-only here');
        expect(result.error).toContain('link to it by id');
    }

    describe('admin_content_search', () => {
        it('reads own entries by default, each with `source: null` [content:I-48]', async () => {
            const agent = await signIn();

            const result = await callTool(agent, 'admin_content_search', {
                typeName: 'test_tag'
            });

            expect(result.ok).toBe(true);
            expect(ids(result.output)).toEqual([ownTag]);
            expect(
                (result.output as { items: Entry[] }).items[0].source
            ).toBeNull();
        });

        it('adds only published shared records with `source: "all"` [content:I-48]', async () => {
            const agent = await signIn();

            const all = await callTool(agent, 'admin_content_search', {
                typeName: 'test_tag',
                source: 'all'
            });
            expect(ids(all.output)).toEqual([ownTag, sharedTag].sort());

            const shared = await callTool(agent, 'admin_content_search', {
                typeName: 'test_tag',
                source: 'shared'
            });
            // Never the draft, never the unshared workspace's tag.
            expect(ids(shared.output)).toEqual([sharedTag]);
            expect(
                (shared.output as { items: Entry[] }).items[0].source
            ).toEqual({
                workspaceId: sharedId,
                workspaceName: 'Brand library'
            });
        });
    });

    describe('admin_content_get', () => {
        it('returns a visible shared record read-only, with its source [content:I-48]', async () => {
            const agent = await signIn();

            const foreign = await callTool(agent, 'admin_content_get', {
                typeName: 'test_tag',
                id: sharedTag
            });
            expect(foreign.ok).toBe(true);
            expect(foreign.output).toMatchObject({
                id: sharedTag,
                source: {
                    workspaceId: sharedId,
                    workspaceName: 'Brand library'
                },
                readOnly: true
            });
            // The owning workspace id is plumbing, never shown to the model.
            expect(foreign.output).not.toHaveProperty('workspaceId');

            const own = await callTool(agent, 'admin_content_get', {
                typeName: 'test_tag',
                id: ownTag
            });
            expect(own.output).toMatchObject({ source: null, readOnly: false });
        });

        it('keeps a foreign draft and an unshared record not-found [content:I-48]', async () => {
            const agent = await signIn();

            for (const id of [sharedDraftTag, privateTag]) {
                const result = await callTool(agent, 'admin_content_get', {
                    typeName: 'test_tag',
                    id
                });
                expect(result.ok).toBe(false);
                expect(result.error).not.toContain('shared workspace');
            }
        });
    });

    describe('writes', () => {
        it('content_propose_update on a shared record says it is read-only [content:I-49]', async () => {
            const agent = await signIn();

            const result = await callTool(agent, 'content_propose_update', {
                typeName: 'test_tag',
                id: sharedTag,
                values: { name: 'Hijacked' },
                summary: 'Rename'
            });

            expectReadOnly(result);
            const after = await callTool(agent, 'admin_content_get', {
                typeName: 'test_tag',
                id: sharedTag
            });
            expect((after.output as Entry).values['name']).toBe(
                'Shared Design'
            );
        });

        it('content_propose_bulk_save refuses an item naming a shared record [content:I-49]', async () => {
            const agent = await signIn();

            const result = await callTool(agent, 'content_propose_bulk_save', {
                typeName: 'test_tag',
                summary: 'Rename both',
                items: [
                    { id: ownTag, values: { name: 'Own Renamed' } },
                    { id: sharedTag, values: { name: 'Hijacked' } }
                ]
            });

            expect(result.ok).toBe(false);
            expect(result.error).toContain('read-only here');
        });

        it('keeps the plain not-found for an unknown id, a foreign draft and an unshared record [content:I-49]', async () => {
            const agent = await signIn();

            for (const id of [randomUUID(), sharedDraftTag, privateTag]) {
                const result = await callTool(agent, 'content_propose_update', {
                    typeName: 'test_tag',
                    id,
                    values: { name: 'x' },
                    summary: 'Rename'
                });
                expect(result.ok).toBe(false);
                expect(result.error).not.toContain('shared workspace');
            }
        });

        it('links a shared record from a new entry [content:I-43]', async () => {
            const agent = await signIn();

            const result = await callTool(agent, 'content_propose_create', {
                typeName: 'test_article',
                values: {
                    text: 'Consumer article',
                    select: 'article',
                    tags: [ownTag, sharedTag]
                },
                summary: 'New article'
            });
            expect(result.ok).toBe(true);

            const list = await agent
                .get('/api/content/test_article')
                .set('X-Workspace-Id', consumerId)
                .expect(200);
            const articleId = list.body.items[0].id as string;
            const tags = await agent
                .get(`/api/content/test_article/${articleId}/relations/tags`)
                .set('X-Workspace-Id', consumerId)
                .expect(200);
            expect(
                (tags.body.items as { id: string }[]).map((t) => t.id).sort()
            ).toEqual([ownTag, sharedTag].sort());
        });

        it('admin_content_revisions says a shared record’s history lives elsewhere', async () => {
            const agent = await signIn();

            const shared = await callTool(agent, 'admin_content_revisions', {
                typeName: 'test_tag',
                id: sharedTag
            });
            expect(shared.ok).toBe(false);
            expect(shared.error).toContain('read-only here');

            // An id the caller cannot see keeps the ordinary empty answer.
            const hidden = await callTool(agent, 'admin_content_revisions', {
                typeName: 'test_tag',
                id: sharedDraftTag
            });
            expect(hidden.ok).toBe(true);
        });
    });
});
