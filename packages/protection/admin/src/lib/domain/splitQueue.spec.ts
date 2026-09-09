import { splitQueue, type ReviewQueueItem } from './types';

/** One queue line; only `requestedBy` matters to the split. */
const ask = (id: string, requestedBy: string): ReviewQueueItem => ({
    id,
    contentType: 'article',
    entryId: `entry-${id}`,
    requestedBy,
    note: null,
    required: 2,
    given: 0,
    createdAt: '2026-09-01T00:00:00.000Z'
});

describe('splitQueue', () => {
    it('puts somebody else’s ask in "waiting on me"', () => {
        const { waitingOnMe, mine } = splitQueue([ask('1', 'anna')], 'boris');

        expect(waitingOnMe.map((item) => item.id)).toEqual(['1']);
        expect(mine).toEqual([]);
    });

    it('puts my own ask in "my requests"', () => {
        const { waitingOnMe, mine } = splitQueue([ask('1', 'boris')], 'boris');

        expect(waitingOnMe).toEqual([]);
        expect(mine.map((item) => item.id)).toEqual(['1']);
    });

    /**
     * The property the page depends on: every line lands in exactly one tab, so
     * the two counts add up to the window and neither can hide work.
     */
    it('partitions the page — every ask in exactly one tab', () => {
        const items = [
            ask('1', 'anna'),
            ask('2', 'boris'),
            ask('3', 'dmitry'),
            ask('4', 'boris')
        ];

        const { waitingOnMe, mine } = splitQueue(items, 'boris');

        expect(waitingOnMe.length + mine.length).toBe(items.length);
        expect([...waitingOnMe, ...mine].map((item) => item.id).sort()).toEqual(
            ['1', '2', '3', '4']
        );
    });

    it('keeps the server’s order inside each tab', () => {
        const { waitingOnMe } = splitQueue(
            [ask('1', 'anna'), ask('2', 'boris'), ask('3', 'dmitry')],
            'boris'
        );

        expect(waitingOnMe.map((item) => item.id)).toEqual(['1', '3']);
    });

    /**
     * An unknown caller — the auth read still in flight — must not be told the
     * queue is all theirs. Everything reads as somebody else's, which is the
     * safe direction: it shows work that exists rather than hiding it.
     */
    it('treats an unknown caller as nobody’s author', () => {
        const { waitingOnMe, mine } = splitQueue(
            [ask('1', 'anna'), ask('2', 'boris')],
            ''
        );

        expect(waitingOnMe).toHaveLength(2);
        expect(mine).toEqual([]);
    });

    it('handles an empty page', () => {
        expect(splitQueue([], 'boris')).toEqual({ waitingOnMe: [], mine: [] });
    });
});
