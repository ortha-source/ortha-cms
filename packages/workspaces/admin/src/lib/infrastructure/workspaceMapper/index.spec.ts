import { describe, expect, it } from 'vitest';
import { toSharedSources, toWorkspace, type WorkspaceView } from '.';

const view: WorkspaceView = {
    id: 'ws_1',
    name: 'Marketing site',
    slug: 'marketing-site',
    description: '',
    color: 'violet',
    status: 'active',
    members: []
};

describe('workspaceMapper — isShared', () => {
    it('reads a response without isShared (an older server) as not shared', () => {
        expect(toWorkspace(view).isShared).toBe(false);
    });

    it('keeps the flag the server sends', () => {
        expect(toWorkspace({ ...view, isShared: true }).isShared).toBe(true);
    });
});

describe('workspaceMapper — sharedContent', () => {
    it('reads a response without sharedContent (an older server) as no shared grants', () => {
        expect(toWorkspace(view).sharedContent).toEqual([]);
    });

    it('maps each grant, reading an absent `available` as available', () => {
        const mapped = toWorkspace({
            ...view,
            sharedContent: [
                {
                    slug: 'tag',
                    kind: 'collection',
                    sourceWorkspaceId: 'ws_travel',
                    sourceWorkspaceName: 'Travel Library'
                },
                {
                    slug: 'home',
                    kind: 'single',
                    sourceWorkspaceId: 'ws_travel',
                    sourceWorkspaceName: 'Travel Library',
                    available: false
                }
            ]
        });
        expect(mapped.sharedContent).toEqual([
            {
                slug: 'tag',
                kind: 'collection',
                sourceWorkspaceId: 'ws_travel',
                sourceWorkspaceName: 'Travel Library',
                available: true
            },
            {
                slug: 'home',
                kind: 'single',
                sourceWorkspaceId: 'ws_travel',
                sourceWorkspaceName: 'Travel Library',
                available: false
            }
        ]);
    });

    it('keeps own grants and shared grants apart', () => {
        const mapped = toWorkspace({
            ...view,
            content: ['tag'],
            sharedContent: [
                {
                    slug: 'tag',
                    kind: 'collection',
                    sourceWorkspaceId: 'ws_travel',
                    sourceWorkspaceName: 'Travel Library',
                    available: true
                }
            ]
        });
        expect(mapped.content).toEqual(['tag']);
        expect(mapped.sharedContent).toHaveLength(1);
    });
});

describe('workspaceMapper — shared sources', () => {
    it('maps the envelope and tolerates a source without content', () => {
        expect(
            toSharedSources({
                items: [
                    {
                        workspaceId: 'ws_travel',
                        workspaceName: 'Travel Library',
                        content: [{ slug: 'tag', kind: 'collection' }]
                    },
                    { workspaceId: 'ws_empty', workspaceName: 'Empty' }
                ]
            })
        ).toEqual([
            {
                workspaceId: 'ws_travel',
                workspaceName: 'Travel Library',
                content: [{ slug: 'tag', kind: 'collection' }]
            },
            { workspaceId: 'ws_empty', workspaceName: 'Empty', content: [] }
        ]);
    });
});
