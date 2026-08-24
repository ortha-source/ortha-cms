import { filterTreeSegments } from './filter-tree-segments';

describe('filterTreeSegments', () => {
    it('reads the relation name out of a dotted path', () => {
        expect(
            filterTreeSegments({
                field: 'author.status',
                op: 'ne',
                value: 'published'
            })
        ).toEqual(new Set(['author']));
    });

    it('walks every branch of an and-group', () => {
        const tree = {
            and: [
                { field: 'status', op: 'eq', value: 'published' },
                { field: 'author.status', op: 'ne', value: 'published' }
            ]
        };
        expect(filterTreeSegments(tree)).toEqual(
            new Set(['status', 'author'])
        );
    });

    it('walks nested groups', () => {
        const tree = {
            and: [
                { field: 'status', op: 'eq', value: 'published' },
                {
                    or: [
                        { field: 'cover', op: 'null', value: true },
                        { field: 'seo.description', op: 'null', value: true }
                    ]
                }
            ]
        };
        expect(filterTreeSegments(tree)).toEqual(
            new Set(['status', 'cover', 'seo'])
        );
    });

    it('takes only the first segment of a multi-hop path', () => {
        expect(
            filterTreeSegments({
                field: 'author.company.name',
                op: 'eq',
                value: 'Acme'
            })
        ).toEqual(new Set(['author']));
    });

    it('is empty for a tree with no leaves', () => {
        expect(filterTreeSegments({})).toEqual(new Set());
        expect(filterTreeSegments({ and: [] })).toEqual(new Set());
    });

    it('ignores anything that is not a tree', () => {
        // A stored filter is data: it can be null, a string, or a number after
        // a bad restore, and the reverse pass must not throw on any of them.
        expect(filterTreeSegments(null)).toEqual(new Set());
        expect(filterTreeSegments('status')).toEqual(new Set());
        expect(filterTreeSegments(42)).toEqual(new Set());
        expect(filterTreeSegments({ field: 42 })).toEqual(new Set());
    });

    it('stops at the depth cap instead of recursing forever', () => {
        // A self-referencing structure cannot come off JSON.parse, but it can
        // be built in memory — and the cap is what keeps the walk bounded for
        // a merely very deep tree too.
        let deep: Record<string, unknown> = {
            field: 'author.status',
            op: 'eq',
            value: 'x'
        };
        for (let i = 0; i < 40; i += 1) deep = { and: [deep] };
        expect(() => filterTreeSegments(deep)).not.toThrow();
        expect(filterTreeSegments(deep)).toEqual(new Set());
    });
});
