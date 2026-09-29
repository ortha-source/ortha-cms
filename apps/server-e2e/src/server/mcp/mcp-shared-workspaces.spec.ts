import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedAllSharedContentGrants,
    seedAuthors,
    seedTags,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'mcp-shared-admin@example.com';
const PASSWORD = 'SecurePass123!';
const MCP_PATH = '/api/v1/mcp';
const ACCEPT = 'application/json, text/event-stream';

/** Published-now columns for a seeded row. */
const PUBLISHED = { status: 'published', publishedAt: new Date() } as const;

/** The minimum a `test_article` needs to be created. */
const VALID = { text: 'Consumer article', select: 'article' } as const;

/** One tool result, parsed. */
interface ToolResult {
    isError: boolean;
    data: Record<string, unknown>;
}

/** One entry as the MCP content tools return it. */
interface Entry {
    id: string;
    values: Record<string, unknown>;
    source?: { workspaceId: string; workspaceName: string } | null;
    readOnly?: boolean;
    relations?: Record<string, { items: { id: string }[]; total: number }>;
}

/**
 * **Shared workspaces** (ADR-0019) through the MCP content tools.
 *
 * The public REST routes keep a type's top-level listing own-workspace, but an
 * agent authoring content has to *find* a library record before it can link
 * one — so the tools take the admin list's `source` vocabulary, report where
 * every record lives, read a visible foreign record read-only, and answer a
 * write on one with a message that says to link it instead of a bare
 * not-found. Everything that stays invisible (drafts, unshared workspaces,
 * ungranted types) is pinned alongside, because a clearer message for the wrong
 * id would be an enumeration signal.
 */
describe('MCP content tools — shared workspaces', () => {
    let harness: TestApp;
    let consumerId: string;
    let sharedId: string;
    let privateId: string;
    let sharedTag: string;
    let sharedDraftTag: string;
    let privateTag: string;
    let ownTag: string;
    let sharedAuthor: string;

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
        privateId = (await seedWorkspace({ name: 'Private', slug: 'private' }))
            .id;
        for (const id of [consumerId, sharedId, privateId]) {
            await seedAllContentGrants(id);
        }
        // Explicit per-source grants (ADR-0019): the consumer reads the shared
        // workspace's records through shared grants of every type — and holds
        // the same grants of the private workspace, which stay inert because it
        // is not shared.
        await seedAllSharedContentGrants(consumerId, sharedId);
        await seedAllSharedContentGrants(consumerId, privateId);
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
        [sharedAuthor] = await seedAuthors(
            [{ name: 'Shared Ada', ...PUBLISHED }],
            sharedId
        );
    });

    /** Mints a token for the consumer workspace through the real API. */
    async function mintToken(scope: 'read' | 'full' = 'full') {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        const res = await agent
            .post('/api/api-tokens')
            .send({ name: 'mcp-shared', workspaceIds: [consumerId], scope })
            .expect(201);
        return res.body.secret as string;
    }

    let nextId = 1;

    /** One `tools/call`, parsed. */
    async function callTool(
        secret: string,
        name: string,
        args: Record<string, unknown>
    ): Promise<ToolResult> {
        const res = await request(harness.server)
            .post(MCP_PATH)
            .set('Authorization', `Bearer ${secret}`)
            .set('Accept', ACCEPT)
            .set('Content-Type', 'application/json')
            .send({
                jsonrpc: '2.0',
                id: nextId++,
                method: 'tools/call',
                params: { name, arguments: args }
            })
            .expect(200);
        const result = res.body.result as {
            isError?: boolean;
            content: { text: string }[];
        };
        return {
            isError: result.isError === true,
            data: JSON.parse(result.content[0].text)
        };
    }

    /** Ids of a list result's items, sorted. */
    function ids(result: ToolResult): string[] {
        return (result.data['items'] as Entry[]).map((item) => item.id).sort();
    }

    /** Asserts the read-only refusal the tools give a visible foreign id. */
    function expectReadOnly(result: ToolResult) {
        expect(result.isError).toBe(true);
        expect(result.data['code']).toBe('forbidden');
        expect(result.data['message']).toContain(
            'shared workspace "Brand library"'
        );
        expect(result.data['message']).toContain('read-only here');
        expect(result.data['message']).toContain('link to it by id');
    }

    describe('discovery', () => {
        it('lists own entries by default, each reporting `source: null` [content:I-48]', async () => {
            const secret = await mintToken();

            const result = await callTool(secret, 'content_list', {
                typeName: 'test_tag'
            });

            expect(ids(result)).toEqual([ownTag]);
            expect((result.data['items'] as Entry[])[0].source).toBeNull();
        });

        it('lists only the published records of shared workspaces with `source: "shared"` [content:I-48]', async () => {
            const secret = await mintToken();

            const result = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'shared'
            });

            // Not the draft, not the unshared workspace's tag, not our own.
            expect(ids(result)).toEqual([sharedTag]);
            expect(result.data['total']).toBe(1);
            expect((result.data['items'] as Entry[])[0].source).toEqual({
                workspaceId: sharedId,
                workspaceName: 'Brand library'
            });
        });

        it('lists both with `source: "all"`, and search spans the union', async () => {
            const secret = await mintToken();

            const all = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'all'
            });
            expect(ids(all)).toEqual([ownTag, sharedTag].sort());

            const searched = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'all',
                search: 'Shared'
            });
            expect(ids(searched)).toEqual([sharedTag]);
        });

        it('never shows a foreign draft, whatever `status` asks for [content:I-48]', async () => {
            const secret = await mintToken('full');

            const drafts = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'shared',
                status: 'any'
            });

            expect(ids(drafts)).toEqual([sharedTag]);
            expect(ids(drafts)).not.toContain(sharedDraftTag);
        });

        it('refuses an unknown `source` as an argument error', async () => {
            const secret = await mintToken();

            const result = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'everyone'
            });

            // The registry's schema check answers first, naming the field.
            expect(result.isError).toBe(true);
            expect(result.data['code']).toBe('validation_failed');
            expect(result.data['issues']).toEqual([
                expect.objectContaining({ field: 'source' })
            ]);
        });

        it('keeps the page-size bound when reading across workspaces', async () => {
            const secret = await mintToken();

            const result = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'all',
                pageSize: 5000
            });

            expect(result.isError).toBe(true);
        });
    });

    describe('reads', () => {
        it('reads a visible shared record read-only, with its source [content:I-48]', async () => {
            const secret = await mintToken();

            const foreign = await callTool(secret, 'content_get', {
                typeName: 'test_tag',
                id: sharedTag
            });
            expect(foreign.isError).toBe(false);
            expect(foreign.data).toMatchObject({
                id: sharedTag,
                values: { name: 'Shared Design' },
                source: {
                    workspaceId: sharedId,
                    workspaceName: 'Brand library'
                },
                readOnly: true
            });

            const own = await callTool(secret, 'content_get', {
                typeName: 'test_tag',
                id: ownTag
            });
            expect(own.data).toMatchObject({ source: null, readOnly: false });
        });

        it('keeps a foreign draft and an unshared workspace’s record not-found [content:I-48]', async () => {
            const secret = await mintToken('full');

            for (const id of [sharedDraftTag, privateTag]) {
                const result = await callTool(secret, 'content_get', {
                    typeName: 'test_tag',
                    id,
                    status: 'any'
                });
                expect(result.isError).toBe(true);
                expect(result.data['code']).toBe('not_found');
                expect(result.data['message']).not.toContain('shared');
            }
        });

        it('hides everything shared from a workspace without the type’s grant', async () => {
            const secret = await mintToken();
            await getPool().query(
                "DELETE FROM workspace_content WHERE workspace_id = $1 AND slug = 'test_author'",
                [consumerId]
            );

            const get = await callTool(secret, 'content_get', {
                typeName: 'test_author',
                id: sharedAuthor
            });
            expect(get.isError).toBe(true);
            expect(get.data['code']).toBe('not_found');
            expect(get.data['message']).not.toContain('shared workspace');
        });
    });

    describe('writes', () => {
        it.each([
            ['content_update', { values: { name: 'Hijacked' } }],
            ['content_publish', {}],
            ['content_unpublish', {}],
            ['content_delete', {}]
        ])(
            '%s on a visible shared record says it is read-only [content:I-49]',
            async (name, extra) => {
                const secret = await mintToken('full');

                const result = await callTool(secret, name, {
                    typeName: 'test_tag',
                    id: sharedTag,
                    ...extra
                });

                expectReadOnly(result);
                // …and it did nothing.
                const after = await callTool(secret, 'content_get', {
                    typeName: 'test_tag',
                    id: sharedTag
                });
                expect(after.data).toMatchObject({
                    values: { name: 'Shared Design' },
                    readOnly: true
                });
            }
        );

        it('keeps the plain not-found for an unknown id, a foreign draft and an unshared record [content:I-49]', async () => {
            const secret = await mintToken('full');

            for (const id of [randomUUID(), sharedDraftTag, privateTag]) {
                const result = await callTool(secret, 'content_update', {
                    typeName: 'test_tag',
                    id,
                    values: { name: 'x' }
                });
                expect(result.isError).toBe(true);
                expect(result.data['code']).toBe('not_found');
                expect(result.data['message']).not.toContain('shared');
            }
        });

        it('refuses a bulk lifecycle write naming a shared record before changing anything [content:I-49]', async () => {
            const secret = await mintToken('full');

            const result = await callTool(secret, 'content_bulk_unpublish', {
                typeName: 'test_tag',
                ids: [ownTag, sharedTag]
            });

            expect(result.isError).toBe(true);
            expect(result.data['code']).toBe('forbidden');
            expect(result.data['message']).toContain(sharedTag);
            expect(result.data['message']).toContain('Nothing was changed');
            // The own tag in the same batch stayed published.
            const own = await callTool(secret, 'content_list', {
                typeName: 'test_tag'
            });
            expect(ids(own)).toEqual([ownTag]);
        });

        it('reports a shared record in a bulk save on its own item [content:I-49]', async () => {
            const secret = await mintToken('full');

            const result = await callTool(secret, 'content_bulk_save', {
                typeName: 'test_tag',
                items: [
                    { id: sharedTag, values: { name: 'Hijacked' } },
                    { id: ownTag, values: { name: 'Own Renamed' } }
                ]
            });

            expect(result.isError).toBe(false);
            const items = result.data['items'] as {
                ok: boolean;
                error?: { status: number; message: string };
            }[];
            expect(items[0].ok).toBe(false);
            expect(items[0].error?.status).toBe(403);
            expect(items[0].error?.message).toContain('read-only here');
            expect(items[1].ok).toBe(true);
        });

        it('links a shared record from a new and an edited entry [content:I-43]', async () => {
            const secret = await mintToken('full');

            const created = await callTool(secret, 'content_create', {
                typeName: 'test_article',
                values: { ...VALID, author: sharedAuthor },
                relations: { tags: { link: [ownTag, sharedTag] } }
            });
            expect(created.isError).toBe(false);
            const id = created.data['id'] as string;

            const [secondShared] = await seedTags(
                [{ name: 'Shared Second', ...PUBLISHED }],
                sharedId
            );
            const updated = await callTool(secret, 'content_update', {
                typeName: 'test_article',
                id,
                values: {},
                relations: { tags: { link: [secondShared] } }
            });
            expect(updated.isError).toBe(false);

            const read = await callTool(secret, 'content_get', {
                typeName: 'test_article',
                id,
                status: 'any',
                relations: 'preview',
                relationFields: 'author,tags'
            });
            const entry = read.data as unknown as Entry;
            expect(entry.readOnly).toBe(false);
            expect(
                entry.relations?.['tags'].items.map((ref) => ref.id).sort()
            ).toEqual([ownTag, sharedTag, secondShared].sort());
            expect(entry.relations?.['author'].items[0].id).toBe(sharedAuthor);
        });

        it('refuses to link a foreign draft', async () => {
            const secret = await mintToken('full');

            const created = await callTool(secret, 'content_create', {
                typeName: 'test_article',
                values: VALID,
                relations: { tags: { link: [sharedDraftTag] } }
            });

            expect(created.isError).toBe(true);
            expect(created.data['message']).not.toContain('shared workspace');
        });
    });

    describe('a type held only through shared grants (explicit per-source grants)', () => {
        beforeEach(async () => {
            // Drop the consumer's own grant of test_tag; its shared grant of
            // the library's test_tag stays.
            await getPool().query(
                "DELETE FROM workspace_content WHERE workspace_id = $1 AND slug = 'test_tag' AND source_workspace_id IS NULL",
                [consumerId]
            );
        });

        it('is discoverable and readable, and every write is a 403 saying why', async () => {
            const secret = await mintToken();

            const types = await callTool(secret, 'content_types_list', {});
            expect(
                (types.data['items'] as { name: string }[]).map((t) => t.name)
            ).toContain('test_tag');

            const listed = await callTool(secret, 'content_list', {
                typeName: 'test_tag',
                source: 'shared'
            });
            expect(ids(listed)).toEqual([sharedTag]);

            const created = await callTool(secret, 'content_create', {
                typeName: 'test_tag',
                values: { name: 'Local copy' }
            });
            expect(created.isError).toBe(true);
            expect(created.data['code']).toBe('forbidden');
            expect(created.data['message']).toBe(
                'This workspace can only use "Test tags" records from shared workspaces; it cannot create its own.'
            );

            const bulk = await callTool(secret, 'content_bulk_delete', {
                typeName: 'test_tag',
                ids: [sharedTag]
            });
            expect(bulk.isError).toBe(true);
            expect(bulk.data['code']).toBe('forbidden');
        });
    });
});
