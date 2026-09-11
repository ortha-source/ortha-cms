import { splitQueue, type ReviewQueueItem } from './types';

/** One queue line; only who asked and who was asked matter to the split. */
const ask = (
    id: string,
    requestedBy: string,
    reviewerIds: string[] = []
): ReviewQueueItem => ({
    id,
    contentType: 'article',
    entryId: `entry-${id}`,
    requestedBy,
    reviewerIds,
    required: 2,
    given: 0,
    createdAt: '2026-09-01T00:00:00.000Z'
});

describe('splitQueue', () => {
    it('puts an ask that names me in "waiting on me"', () => {
        const { waitingOnMe, mine } = splitQueue(
            [ask('1', 'anna', ['boris'])],
            'boris'
        );

        expect(waitingOnMe.map((item) => item.id)).toEqual(['1']);
        expect(mine).toEqual([]);
    });

    /** A request names who is asked; somebody else's name is not a wait on me. */
    it('leaves out an ask that names somebody else', () => {
        const { waitingOnMe, mine } = splitQueue(
            [ask('1', 'anna', ['dmitry'])],
            'boris'
        );

        expect(waitingOnMe).toEqual([]);
        expect(mine).toEqual([]);
    });

    it('puts my own ask in "my requests"', () => {
        const { waitingOnMe, mine } = splitQueue(
            [ask('1', 'boris', ['anna'])],
            'boris'
        );

        expect(waitingOnMe).toEqual([]);
        expect(mine.map((item) => item.id)).toEqual(['1']);
    });

    it('never puts one ask in both tabs', () => {
        const items = [
            ask('1', 'anna', ['boris']),
            ask('2', 'boris', ['anna']),
            ask('3', 'dmitry', ['boris', 'anna']),
            ask('4', 'dmitry', ['anna'])
        ];

        const { waitingOnMe, mine } = splitQueue(items, 'boris');

        expect(waitingOnMe.map((item) => item.id)).toEqual(['1', '3']);
        expect(mine.map((item) => item.id)).toEqual(['2']);
    });

    /**
     * An unknown caller — the auth read still in flight — is nobody: no ask is
     * theirs and none is waiting on them, rather than every ask matching an
     * empty id by accident.
     */
    it('gives an unknown caller empty tabs', () => {
        expect(splitQueue([ask('1', 'anna', ['boris'])], '')).toEqual({
            waitingOnMe: [],
            mine: []
        });
    });

    it('handles an empty page', () => {
        expect(splitQueue([], 'boris')).toEqual({ waitingOnMe: [], mine: [] });
    });
});
