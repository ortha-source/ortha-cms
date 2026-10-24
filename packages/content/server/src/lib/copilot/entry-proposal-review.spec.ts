import { EntryProposalToolProvider } from './entry-proposal.provider';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import type { EntryWriterService } from '../entries/infrastructure/persistence/entry-writer.service';
import type { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import type { ToolDefinition } from '@orthacms/tools-server';
import type { ProposalDraft } from '@orthacms/copilot-domain';

/**
 * What the copilot's review card reads off a content draft: **which record**
 * each row belongs to, and **where the change lands** — the two facts the
 * permission prompt turns into "save 23 records as drafts; published versions
 * stay live". And that the three tools vouch for a pure handler, which is the
 * only thing that lets the engine preview them before asking.
 */
describe('content propose tools describe their change for review', () => {
    const WORKSPACE = 'ws-1';

    function toolsOf(publishable: boolean) {
        const type = {
            name: 'article',
            publishable,
            fields: {
                title: { type: 'text' },
                summary: { type: 'textarea' }
            }
        };
        const registry = {
            get: () => type,
            serialize: () => ({
                fields: [
                    { name: 'title', type: 'text' },
                    {
                        name: 'summary',
                        type: 'textarea',
                        admin: { label: 'Summary' }
                    }
                ]
            })
        } as unknown as ContentTypeRegistry;
        const grants = {
            grantedSlugs: async () => new Set(['article']),
            reachableSlugs: async () => new Set(['article']),
            access: async () =>
                new Map([['article', { own: true, sharedSources: [] }]])
        } as unknown as WorkspaceGrantsQuery;
        const entries: Record<string, Record<string, unknown>> = {
            'entry-1': { title: 'Spring launch', summary: '' },
            'entry-2': { title: 'Webhooks, retried', summary: null }
        };
        const writer = {
            getOne: async (_type: unknown, id: string) => ({
                values: entries[id]
            })
        } as unknown as EntryWriterService;

        const provider = new EntryProposalToolProvider(
            registry,
            writer,
            grants
        );
        const byName = new Map<string, ToolDefinition>();
        for (const tool of provider.tools()) byName.set(tool.name, tool);
        return byName;
    }

    const run = (tool: ToolDefinition | undefined, input: object) =>
        (tool as ToolDefinition).handler(
            input as Record<string, unknown>,
            {
                workspaceId: WORKSPACE
            } as never
        ) as Promise<ProposalDraft>;

    it('marks all three write tools previewable', () => {
        const tools = toolsOf(true);
        for (const name of [
            'content_propose_create',
            'content_propose_update',
            'content_propose_bulk_save'
        ]) {
            expect(tools.get(name)?.previewable).toBe(true);
        }
    });

    it('groups a batch under each entry’s current title, unnumbered', async () => {
        const draft = await run(
            toolsOf(true).get('content_propose_bulk_save'),
            {
                typeName: 'article',
                items: [
                    {
                        id: 'entry-1',
                        values: { summary: 'Everything that shipped' }
                    },
                    {
                        id: 'entry-2',
                        values: { summary: 'Deliveries that survive' }
                    }
                ],
                summary: 'Write two summaries'
            }
        );

        expect(draft.changes).toEqual([
            {
                field: 'items[0].summary',
                label: 'Summary',
                record: 'Spring launch',
                before: '',
                after: 'Everything that shipped'
            },
            {
                field: 'items[1].summary',
                label: 'Summary',
                record: 'Webhooks, retried',
                before: null,
                after: 'Deliveries that survive'
            }
        ]);
        expect(draft.lands).toBe('draft');
    });

    it('says a change on a type that is not publishable goes live', async () => {
        const draft = await run(toolsOf(false).get('content_propose_update'), {
            typeName: 'article',
            id: 'entry-1',
            values: { summary: 'Everything that shipped' },
            summary: 'Write the summary'
        });

        expect(draft.lands).toBe('live');
        expect(draft.changes?.[0]).toMatchObject({ record: 'Spring launch' });
    });

    it('names a created record by its own title', async () => {
        const draft = await run(toolsOf(true).get('content_propose_create'), {
            typeName: 'article',
            values: { title: 'Security at Ortha' },
            summary: 'New article'
        });

        expect(draft.changes?.[0]).toMatchObject({
            field: 'title',
            record: 'Security at Ortha'
        });
    });
});
