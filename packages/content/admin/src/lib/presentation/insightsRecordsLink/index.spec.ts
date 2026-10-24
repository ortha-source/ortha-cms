import { insightsRecordLink, insightsRecordsLink } from '.';

const NOW = new Date('2026-10-24T12:00:00Z');

/** The `?filter=` JSON a link carries, parsed. */
function filterOf(link: string): unknown {
    const search = link.slice(link.indexOf('?'));
    return JSON.parse(new URLSearchParams(search).get('filter') ?? 'null');
}

describe('insightsRecordsLink', () => {
    it('opens a type’s records on the Modified chip’s own conditions', () => {
        const link = insightsRecordsLink('article', { kind: 'modified' }, NOW);
        expect(link.startsWith('../content/article?filter=')).toBe(true);
        expect(filterOf(link)).toEqual({
            and: [
                { field: 'status', op: 'eq', value: 'draft' },
                { field: 'publishedAt', op: 'null', value: false }
            ]
        });
    });

    it('bounds a stale band on both edges, published only', () => {
        const link = insightsRecordsLink(
            'guide',
            { kind: 'stale', age: 'months' },
            NOW
        );
        expect(filterOf(link)).toEqual({
            and: [
                { field: 'status', op: 'eq', value: 'published' },
                { field: 'updatedAt', op: 'lte', value: '2026-07-26' },
                { field: 'updatedAt', op: 'gt', value: '2025-10-24' }
            ]
        });
    });

    it('leaves "over a year" open-ended', () => {
        const link = insightsRecordsLink(
            'guide',
            { kind: 'stale', age: 'year' },
            NOW
        );
        expect(filterOf(link)).toEqual({
            and: [
                { field: 'status', op: 'eq', value: 'published' },
                { field: 'updatedAt', op: 'lte', value: '2025-10-24' }
            ]
        });
    });

    it('links one record by type and id', () => {
        expect(insightsRecordLink('guide', 'e1')).toBe('../content/guide/e1');
    });
});
