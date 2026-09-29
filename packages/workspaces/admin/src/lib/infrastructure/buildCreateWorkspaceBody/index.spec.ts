import { describe, expect, it } from 'vitest';
import type { WizardSnapshot } from '../../domain/types/wizard';
import { buildCreateWorkspaceBody } from '.';

const snapshot: WizardSnapshot = {
    data: {
        name: ' Travel ',
        slug: 'travel',
        slugEdited: false,
        description: '',
        color: 'slate'
    },
    members: [],
    contentMode: 'specific',
    collections: { mode: 'specific', ids: ['post'] },
    pages: { mode: 'specific', ids: [] },
    sharedContent: [{ slug: 'tag', sourceWorkspaceId: 'ws_library' }]
};

describe('buildCreateWorkspaceBody — shared content', () => {
    it('sends the shared picks beside a specific selection', () => {
        const body = buildCreateWorkspaceBody(snapshot);
        expect(body.content).toEqual({
            mode: 'specific',
            collections: { mode: 'specific', ids: ['post'] },
            pages: { mode: 'specific', ids: [] },
            sharedContent: [{ slug: 'tag', sourceWorkspaceId: 'ws_library' }]
        });
    });

    it('leaves the field out when nothing shared was picked', () => {
        const body = buildCreateWorkspaceBody({
            ...snapshot,
            sharedContent: []
        });
        expect(body.content).not.toHaveProperty('sharedContent');
    });

    it('never sends shared picks with "All content" — that is own types only', () => {
        const body = buildCreateWorkspaceBody({
            ...snapshot,
            contentMode: 'all'
        });
        expect(body.content).toEqual({ mode: 'all' });
    });
});
