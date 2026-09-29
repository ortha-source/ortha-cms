import {
    isReachable,
    resolveContentAccess,
    visibleSources
} from './content-access';

const W = '11111111-1111-4111-8111-111111111111';
const LIB = '22222222-2222-4222-8222-222222222222';
const BRAND = '33333333-3333-4333-8333-333333333333';

describe('content access — explicit per-source grants (ADR-0019)', () => {
    it('an own grant alone: W only', () => {
        const access = resolveContentAccess([
            { slug: 'tag', sourceWorkspaceId: null }
        ]).get('tag');
        expect(access).toEqual({ own: true, sharedSources: [] });
        expect(visibleSources(W, access)).toEqual([W]);
        expect(isReachable(access)).toBe(true);
    });

    it('a shared grant alone: reachable, not own, the source only', () => {
        const access = resolveContentAccess([
            {
                slug: 'tag',
                sourceWorkspaceId: LIB,
                sourceWorkspaceName: 'Travel Library',
                sourceAvailable: true
            }
        ]).get('tag');
        expect(access).toEqual({
            own: false,
            sharedSources: [
                { workspaceId: LIB, workspaceName: 'Travel Library' }
            ]
        });
        expect(visibleSources(W, access)).toEqual([LIB]);
        expect(isReachable(access)).toBe(true);
    });

    it('both: own id first, then the sources by name', () => {
        const access = resolveContentAccess([
            {
                slug: 'tag',
                sourceWorkspaceId: LIB,
                sourceWorkspaceName: 'Travel Library',
                sourceAvailable: true
            },
            { slug: 'tag', sourceWorkspaceId: null },
            {
                slug: 'tag',
                sourceWorkspaceId: BRAND,
                sourceWorkspaceName: 'Brand',
                sourceAvailable: true
            }
        ]).get('tag');
        expect(visibleSources(W, access)).toEqual([W, BRAND, LIB]);
    });

    it('an inert shared grant exposes nothing and does not make the type reachable', () => {
        const map = resolveContentAccess([
            {
                slug: 'tag',
                sourceWorkspaceId: LIB,
                sourceWorkspaceName: 'Travel Library',
                sourceAvailable: false
            }
        ]);
        expect(map.has('tag')).toBe(false);
        expect(isReachable(map.get('tag'))).toBe(false);
        expect(visibleSources(W, map.get('tag'))).toEqual([]);
    });

    it('an inert shared grant beside an own grant leaves the own grant alone', () => {
        const access = resolveContentAccess([
            { slug: 'tag', sourceWorkspaceId: null },
            {
                slug: 'tag',
                sourceWorkspaceId: LIB,
                sourceWorkspaceName: 'Travel Library',
                sourceAvailable: false
            }
        ]).get('tag');
        expect(access).toEqual({ own: true, sharedSources: [] });
    });

    it('keeps slugs apart — a grant of one type says nothing about another', () => {
        const map = resolveContentAccess([
            { slug: 'article', sourceWorkspaceId: null },
            {
                slug: 'tag',
                sourceWorkspaceId: LIB,
                sourceWorkspaceName: 'Travel Library',
                sourceAvailable: true
            }
        ]);
        expect(map.get('article')?.sharedSources).toEqual([]);
        expect(map.get('tag')?.own).toBe(false);
        expect(map.has('author')).toBe(false);
    });

    it('de-duplicates a source named twice', () => {
        const row = {
            slug: 'tag',
            sourceWorkspaceId: LIB,
            sourceWorkspaceName: 'Travel Library',
            sourceAvailable: true
        };
        expect(
            resolveContentAccess([row, row]).get('tag')?.sharedSources
        ).toHaveLength(1);
    });
});
