import { describe, expect, it } from 'vitest';
import { mediaInsightsKeys } from '../../hooks/useMediaInsights';
import { mediaKeys } from './index';

/**
 * Every cache key the plugin mints, enumerated rather than listed.
 *
 * `useMediaLibrary`'s own spec proves the two keys it uses reach the cache
 * scoped; this is the claim over the *set* — including the three Insights keys,
 * which no component test touches, and including whichever key is added next.
 * Reflecting over the exported objects is the point: a new factory written
 * without a `workspaceId` parameter fails here on the day it is written, which
 * a hand-listed set of cases would not.
 *
 * The rule exists because the workspace travels as an ambient `X-Workspace-Id`
 * header, and a cache hit sends no header at all. An unscoped key does not
 * mis-scope a *request*; it skips the request and answers with the previous
 * workspace's data.
 */
describe('media cache keys', () => {
    const WORKSPACE = 'ws-7f3c';

    /**
     * The two key namespaces, flattened to `[label, factory]`. Each factory
     * takes the workspace first; the extra arguments cover `assets(workspaceId,
     * folderId, list)` and `uploads(workspaceId, days)` and are ignored by the
     * shorter ones.
     */
    const FACTORIES = [
        ...Object.entries(mediaKeys).map(
            ([name, fn]) => [`mediaKeys.${name}`, fn] as const
        ),
        ...Object.entries(mediaInsightsKeys).map(
            ([name, fn]) => [`mediaInsightsKeys.${name}`, fn] as const
        )
    ];

    it('found the key factories to check', () => {
        // Reflection over an object that had been renamed or restructured
        // would iterate nothing and pass.
        expect(FACTORIES.length).toBeGreaterThanOrEqual(7);
        expect(FACTORIES.map(([name]) => name)).toEqual(
            expect.arrayContaining([
                'mediaKeys.all',
                'mediaKeys.folders',
                'mediaKeys.assets',
                'mediaInsightsKeys.all',
                'mediaInsightsKeys.storage',
                'mediaInsightsKeys.uploads',
                'mediaInsightsKeys.alt'
            ])
        );
    });

    // covers: media:I-40
    it.each(FACTORIES)('%s names the workspace', (_label, factory) => {
        const key = (
            factory as (
                workspaceId: string,
                ...rest: unknown[]
            ) => readonly unknown[]
        )(WORKSPACE, 'folder-1', { page: 1 });

        expect(key).toContain(WORKSPACE);
    });

    // covers: media:I-40
    it('keeps the workspace above everything a mutation invalidates', () => {
        // Mutations invalidate `mediaKeys.all(workspaceId)`, which only reaches
        // the folders and assets keys because it is a *prefix* of them. Were
        // the id appended rather than placed second, the invalidation would
        // stop matching and the grid would go stale after every write.
        const all = mediaKeys.all(WORKSPACE);

        expect(mediaKeys.folders(WORKSPACE).slice(0, all.length)).toEqual([
            ...all
        ]);
        expect(
            mediaKeys
                .assets(WORKSPACE, 'folder-1', { page: 1, pageSize: 24 })
                .slice(0, all.length)
        ).toEqual([...all]);
    });
});
