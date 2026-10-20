import { QueryClient } from '@tanstack/react-query';
import { refreshAfterCopilotChange } from './refreshAfterChange';

describe('refreshAfterCopilotChange', () => {
    it('marks the page’s queries stale and leaves the copilot’s own alone', () => {
        const queryClient = new QueryClient();
        const keys = {
            entry: ['content-entry', 'ws', 'article', 'e42'],
            entries: ['content-entries', 'ws', 'article'],
            media: ['media', 'assets', 'ws'],
            thread: ['copilot', 'conversation', 'c1'],
            usage: ['copilot', 'usage', 'ws']
        };
        for (const queryKey of Object.values(keys)) {
            queryClient.setQueryData(queryKey, {});
        }

        refreshAfterCopilotChange(queryClient);

        const stale = (queryKey: readonly unknown[]) =>
            queryClient.getQueryState(queryKey)?.isInvalidated;
        expect(stale(keys.entry)).toBe(true);
        expect(stale(keys.entries)).toBe(true);
        expect(stale(keys.media)).toBe(true);
        // The transcript being streamed into, and the meter that refreshes
        // when the run ends.
        expect(stale(keys.thread)).toBe(false);
        expect(stale(keys.usage)).toBe(false);
    });
});
