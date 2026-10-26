import { latest, summarizeEntryStats } from './entry-stats.summary';

const at = (iso: string) => new Date(iso);

describe('summarizeEntryStats', () => {
    it('sums each workspace across its types and keeps the newest edit', () => {
        const summaries = summarizeEntryStats([
            {
                workspaceId: 'w1',
                slug: 'article',
                count: 3,
                lastEditedAt: at('2026-10-01T10:00:00Z')
            },
            {
                workspaceId: 'w1',
                slug: 'author',
                count: 2,
                lastEditedAt: at('2026-10-02T09:00:00Z')
            },
            {
                workspaceId: 'w2',
                slug: 'article',
                count: 7,
                lastEditedAt: at('2026-09-30T00:00:00Z')
            }
        ]);

        expect(summaries.get('w1')).toEqual({
            total: 5,
            byType: { article: 3, author: 2 },
            lastEditedAt: at('2026-10-02T09:00:00Z')
        });
        expect(summaries.get('w2')?.total).toBe(7);
    });

    it('leaves a workspace with no entries out, so callers read it as empty', () => {
        const summaries = summarizeEntryStats([
            { workspaceId: 'w1', slug: 'article', count: 0, lastEditedAt: null }
        ]);
        expect(summaries.has('w1')).toBe(false);
    });

    it('adds up a type reported twice rather than overwriting it', () => {
        const summaries = summarizeEntryStats([
            {
                workspaceId: 'w1',
                slug: 'article',
                count: 1,
                lastEditedAt: null
            },
            { workspaceId: 'w1', slug: 'article', count: 4, lastEditedAt: null }
        ]);
        expect(summaries.get('w1')?.byType).toEqual({ article: 5 });
        expect(summaries.get('w1')?.lastEditedAt).toBeNull();
    });
});

describe('latest', () => {
    it('prefers whichever instant exists, then the later one', () => {
        const a = at('2026-01-01T00:00:00Z');
        const b = at('2026-02-01T00:00:00Z');
        expect(latest(null, null)).toBeNull();
        expect(latest(a, null)).toBe(a);
        expect(latest(null, b)).toBe(b);
        expect(latest(a, b)).toBe(b);
        expect(latest(b, a)).toBe(b);
    });
});
