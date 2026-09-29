import { NotFoundException } from '@nestjs/common';
import type { ToolDefinition } from '@orthacms/tools-server';
import type { ProposalActor } from '@orthacms/copilot-domain';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import type { EntriesService } from '../entries/infrastructure/queries/entries.service';
import type { EntryWriterService } from '../entries/infrastructure/persistence/entry-writer.service';
import type { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import type { SharedSourcesQuery } from '../entries/infrastructure/queries/shared-sources.query';
import type { RevisionStore } from '../revisions/application/ports/revision-store';
import { ContentCopilotToolProvider } from './content-tool.provider';
import { EntryProposalToolProvider } from './entry-proposal.provider';
import { RevisionCopilotToolProvider } from './revision-tool.provider';
import {
    BulkSaveEntriesProposalApplier,
    UpdateEntryProposalApplier
} from './entry-proposal.applier';

/**
 * The copilot's content tools and **shared workspaces** (ADR-0019), without a
 * database: what each tool asks the admin services for, and what it says when
 * the model names a record that belongs to a shared workspace.
 *
 * The visibility rule itself is `SharedSourcesQuery`'s and is exercised
 * against Postgres in `apps/server-e2e`; here a stub knows exactly one visible
 * foreign record, `FOREIGN`, and every own-workspace read of it 404s — which is
 * what `EntryWriterService.getOne` does for any id outside the workspace.
 */
const WORKSPACE = 'ws-1';
const FOREIGN = '3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91';
const UNKNOWN = '9c2e5b40-1a77-4f3d-b0e6-2d1c4a8f6b03';
const LIBRARY = { workspaceId: 'library-ws', workspaceName: 'Library' };
const TYPE = { name: 'article' };

const registry = {
    get: (name: string) => (name === 'article' ? TYPE : undefined),
    summaries: () => [],
    serialize: () => ({ fields: [{ name: 'title', type: 'text' }] })
} as unknown as ContentTypeRegistry;

const grants = {
    grantedSlugs: async () => new Set(['article'])
} as unknown as WorkspaceGrantsQuery;

const shared = {
    foreignVisibleRows: async (_type: unknown, keys: readonly string[]) =>
        new Map(
            keys.filter((key) => key === FOREIGN).map((key) => [key, LIBRARY])
        )
} as unknown as SharedSourcesQuery;

/** Every own-workspace read misses; the admin's visible read finds FOREIGN. */
const writer = {
    getOne: async (_type: unknown, id: string) => {
        throw new NotFoundException(`No entry "${id}".`);
    },
    getVisible: async (_type: unknown, id: string) => {
        if (id !== FOREIGN) throw new NotFoundException(`No entry "${id}".`);
        return {
            id,
            values: { title: 'Library title', body: 'long' },
            source: LIBRARY,
            readOnly: true,
            workspaceId: LIBRARY.workspaceId
        };
    },
    update: async () => {
        throw new Error('a shared record must never reach the writer');
    }
} as unknown as EntryWriterService;

const ctx = { workspaceId: WORKSPACE } as never;

function tool(tools: readonly ToolDefinition[], name: string) {
    const found = tools.find((candidate) => candidate.name === name);
    if (!found) throw new Error(`no tool named ${name}`);
    return found;
}

async function refusal(run: () => Promise<unknown>): Promise<Error | null> {
    try {
        await run();
        return null;
    } catch (error) {
        return error as Error;
    }
}

/** The assertions every read-only refusal owes the model. */
function expectReadOnly(error: Error | null) {
    expect(error).toMatchObject({ status: 403 });
    expect(error?.message).toContain('shared workspace "Library"');
    expect(error?.message).toContain('read-only here');
    expect(error?.message).toContain('never create a local copy');
}

describe('copilot read tools and shared workspaces', () => {
    function reads() {
        const listed: unknown[] = [];
        const entries = {
            list: async (_type: unknown, query: unknown) => {
                listed.push(query);
                return { items: [], total: 0, page: 1, pageSize: 10 };
            }
        } as unknown as EntriesService;
        const provider = new ContentCopilotToolProvider(
            registry,
            entries,
            writer,
            grants
        );
        return { listed, tools: provider.tools() };
    }

    it('admin_content_search forwards `source`, defaulting to own [content:I-48]', async () => {
        const { listed, tools } = reads();
        const search = tool(tools, 'admin_content_search');

        await search.handler({ typeName: 'article' }, ctx);
        await search.handler({ typeName: 'article', source: 'all' }, ctx);

        expect(listed).toEqual([
            expect.objectContaining({ source: 'own' }),
            expect.objectContaining({ source: 'all' })
        ]);
    });

    it('admin_content_search keeps its page-size clamp', async () => {
        const { listed, tools } = reads();

        await tool(tools, 'admin_content_search').handler(
            { typeName: 'article', source: 'shared', pageSize: 500 },
            ctx
        );

        expect(listed).toEqual([
            expect.objectContaining({ pageSize: 25, source: 'shared' })
        ]);
    });

    it('admin_content_search refuses an unknown `source`', async () => {
        const { listed, tools } = reads();

        await expect(
            tool(tools, 'admin_content_search').handler(
                { typeName: 'article', source: 'everyone' },
                ctx
            )
        ).rejects.toMatchObject({ status: 400 });
        expect(listed).toEqual([]);
    });

    it('admin_content_get returns a visible shared record read-only [content:I-48]', async () => {
        const { tools } = reads();

        const entry = await tool(tools, 'admin_content_get').handler(
            { typeName: 'article', id: FOREIGN, fields: ['title'] },
            ctx
        );

        expect(entry).toEqual({
            id: FOREIGN,
            values: { title: 'Library title' },
            source: LIBRARY,
            readOnly: true
        });
    });
});

describe('copilot write paths refuse shared records', () => {
    const proposals = new EntryProposalToolProvider(
        registry,
        writer,
        grants,
        undefined,
        undefined,
        shared
    ).tools();

    it('content_propose_update on a shared record says it is read-only [content:I-49]', async () => {
        expectReadOnly(
            await refusal(() =>
                tool(proposals, 'content_propose_update').handler(
                    {
                        typeName: 'article',
                        id: FOREIGN,
                        values: { title: 'x' },
                        summary: 's'
                    },
                    ctx
                )
            )
        );
    });

    it('content_propose_update keeps the plain not-found for an unknown id [content:I-49]', async () => {
        const error = await refusal(() =>
            tool(proposals, 'content_propose_update').handler(
                {
                    typeName: 'article',
                    id: UNKNOWN,
                    values: { title: 'x' },
                    summary: 's'
                },
                ctx
            )
        );

        expect(error).toBeInstanceOf(NotFoundException);
        expect(error?.message).not.toContain('shared');
    });

    it('content_propose_bulk_save refuses an item naming a shared record [content:I-49]', async () => {
        expectReadOnly(
            await refusal(() =>
                tool(proposals, 'content_propose_bulk_save').handler(
                    {
                        typeName: 'article',
                        items: [{ id: FOREIGN, values: { title: 'x' } }],
                        summary: 's'
                    },
                    ctx
                )
            )
        );
    });

    const actor = { workspaceId: WORKSPACE, userId: 'u-1' } as ProposalActor;

    it('the update applier refuses a shared record [content:I-49]', async () => {
        const applier = new UpdateEntryProposalApplier(
            registry,
            writer,
            grants,
            shared
        );

        expectReadOnly(
            await refusal(() =>
                applier.apply(
                    {
                        target: { typeName: 'article', entryId: FOREIGN },
                        patch: { values: { title: 'x' } }
                    },
                    actor
                )
            )
        );
    });

    it('the bulk applier names the item and that nothing was saved [content:I-49]', async () => {
        const applier = new BulkSaveEntriesProposalApplier(
            registry,
            writer,
            grants,
            shared
        );

        const error = await refusal(() =>
            applier.apply(
                {
                    target: { typeName: 'article' },
                    patch: { items: [{ id: FOREIGN, values: { title: 'x' } }] }
                },
                actor
            )
        );

        expect(error?.message).toContain('Entry 1 of 1 failed');
        expect(error?.message).toContain('read-only here');
        expect(error?.message).toContain('Nothing was saved.');
    });
});

describe('copilot revision tools and shared workspaces', () => {
    const revisions = {
        list: async () => ({ items: [], total: 0 }),
        get: async () => null
    } as unknown as RevisionStore;
    const tools = new RevisionCopilotToolProvider(
        registry,
        revisions,
        grants,
        undefined,
        shared
    ).tools();

    it('admin_content_revisions explains that a shared record’s history lives elsewhere', async () => {
        const error = await refusal(() =>
            tool(tools, 'admin_content_revisions').handler(
                { typeName: 'article', id: FOREIGN },
                ctx
            )
        );

        expectReadOnly(error);
        expect(error?.message).toContain('version history is not available');
    });

    it('admin_content_revisions keeps the empty answer for an unknown id', async () => {
        await expect(
            tool(tools, 'admin_content_revisions').handler(
                { typeName: 'article', id: UNKNOWN },
                ctx
            )
        ).resolves.toMatchObject({ items: [], total: 0 });
    });

    it('admin_content_diff explains a shared record the same way', async () => {
        expectReadOnly(
            await refusal(() =>
                tool(tools, 'admin_content_diff').handler(
                    { typeName: 'article', id: FOREIGN, from: 1, to: 2 },
                    ctx
                )
            )
        );
    });
});
