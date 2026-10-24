import { describe, expect, it } from 'vitest';
import type { Workspace } from '../types/workspace';
import { sortWorkspaces } from '.';

const ws = (
    name: string,
    lastEditedAt: string | null,
    createdAt: string | null = null
): Workspace => ({
    id: name,
    slug: name.toLowerCase(),
    name,
    description: '',
    color: 'slate',
    status: 'Active',
    members: [],
    content: [],
    isShared: false,
    sharedContent: [],
    recordCount: 0,
    recordCountByType: {},
    createdAt,
    lastEditedAt,
    archivedAt: null
});

const names = (list: Workspace[]) => list.map((w) => w.name);

describe('sortWorkspaces', () => {
    const list = [
        ws('beta', '2026-10-01T00:00:00Z', '2026-01-03T00:00:00Z'),
        ws('Alpha', '2026-10-20T00:00:00Z', '2026-01-01T00:00:00Z'),
        ws('gamma', null, '2026-01-02T00:00:00Z')
    ];

    it('puts the most recently edited first, unknown last', () => {
        expect(names(sortWorkspaces(list, 'edited'))).toEqual([
            'Alpha',
            'beta',
            'gamma'
        ]);
    });

    it('sorts by name without regard to case', () => {
        expect(names(sortWorkspaces(list, 'name'))).toEqual([
            'Alpha',
            'beta',
            'gamma'
        ]);
    });

    it('puts the newest first', () => {
        expect(names(sortWorkspaces(list, 'created'))).toEqual([
            'beta',
            'gamma',
            'Alpha'
        ]);
    });

    it('breaks ties by name and leaves its input alone', () => {
        const tied = [ws('b', null), ws('a', null)];
        expect(names(sortWorkspaces(tied, 'edited'))).toEqual(['a', 'b']);
        expect(names(tied)).toEqual(['b', 'a']);
    });
});
