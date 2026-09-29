import { describe, expect, it } from 'vitest';
import { toWorkspace, type WorkspaceView } from '.';

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
