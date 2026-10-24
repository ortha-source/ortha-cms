import { ApiError } from '@orthacms/utils-admin';
import { retrySequentially } from './index';

describe('"Retry all" — one at a time, stopping on a real failure', () => {
    it('sends every id in order, one after the other', async () => {
        const sent: string[] = [];
        let inFlight = 0;
        const outcome = await retrySequentially(['a', 'b', 'c'], async (id) => {
            inFlight += 1;
            expect(inFlight).toBe(1);
            sent.push(id);
            await Promise.resolve();
            inFlight -= 1;
        });
        expect(sent).toEqual(['a', 'b', 'c']);
        expect(outcome).toEqual({
            queued: ['a', 'b', 'c'],
            gone: [],
            skipped: [],
            error: null
        });
    });

    it('counts a 404 or 409 as "no longer parked" and carries on', async () => {
        const outcome = await retrySequentially(['a', 'b', 'c'], async (id) => {
            if (id === 'a') throw new ApiError(404);
            if (id === 'b') throw new ApiError(409);
        });
        expect(outcome.gone).toEqual(['a', 'b']);
        expect(outcome.queued).toEqual(['c']);
        expect(outcome.error).toBeNull();
    });

    it('stops at the first other failure and sends nothing after it', async () => {
        const sent: string[] = [];
        const failure = new ApiError(500);
        const outcome = await retrySequentially(
            ['a', 'b', 'c', 'd'],
            async (id) => {
                sent.push(id);
                if (id === 'b') throw failure;
            }
        );
        expect(sent).toEqual(['a', 'b']);
        expect(outcome.queued).toEqual(['a']);
        expect(outcome.skipped).toEqual(['c', 'd']);
        expect(outcome.error).toBe(failure);
    });

    it('tells the caller which row it is on', async () => {
        const seen: string[] = [];
        await retrySequentially(
            ['a', 'b'],
            async () => undefined,
            (id) => seen.push(id)
        );
        expect(seen).toEqual(['a', 'b']);
    });
});
