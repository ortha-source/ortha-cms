import { daysBetween, groupByDay } from './index';

/** A minimal event: only `at` matters here. */
const at = (date: Date, id = date.toISOString()) => ({ id, at: date });

describe('the feed’s day groups', () => {
    const now = new Date(2026, 9, 24, 12, 0, 0);

    it('counts calendar days in the reader’s timezone, not 24-hour spans', () => {
        expect(daysBetween(new Date(2026, 9, 24, 0, 1), now)).toBe(0);
        expect(daysBetween(new Date(2026, 9, 23, 23, 59), now)).toBe(1);
        expect(daysBetween(new Date(2026, 9, 20, 12, 0), now)).toBe(4);
    });

    it('splits a newest-first list into Today, Yesterday and older dates', () => {
        const groups = groupByDay(
            [
                at(new Date(2026, 9, 24, 10, 42)),
                at(new Date(2026, 9, 24, 9, 12)),
                at(new Date(2026, 9, 23, 17, 20)),
                at(new Date(2026, 9, 21, 8, 0))
            ],
            now
        );
        expect(groups.map((group) => group.kind)).toEqual([
            'today',
            'yesterday',
            'date'
        ]);
        expect(groups.map((group) => group.events.length)).toEqual([2, 1, 1]);
    });

    it('never re-sorts: a day that comes back later starts a new run', () => {
        // Sorted by kind, the server can interleave days; the feed renders
        // what it was given rather than disagreeing with the next page.
        const groups = groupByDay(
            [
                at(new Date(2026, 9, 24, 10), 'a'),
                at(new Date(2026, 9, 23, 10), 'b'),
                at(new Date(2026, 9, 24, 9), 'c')
            ],
            now
        );
        expect(groups.map((group) => group.events.map((e) => e.id))).toEqual([
            ['a'],
            ['b'],
            ['c']
        ]);
    });

    it('keeps an event with an unparseable time instead of inventing a day [activity:I-25]', () => {
        const groups = groupByDay([at(new Date('not-a-date'), 'bad')], now);
        expect(groups).toHaveLength(1);
        expect(groups[0].key).toBe('invalid');
        expect(groups[0].events.map((e) => e.id)).toEqual(['bad']);
    });

    it('returns nothing for nothing', () => {
        expect(groupByDay([], now)).toEqual([]);
    });
});
