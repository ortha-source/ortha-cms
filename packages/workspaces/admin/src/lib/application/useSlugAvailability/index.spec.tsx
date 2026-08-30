import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlugStatus } from '../../domain/types/wizard';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import { useSlugAvailability } from './index';

// The request is the gateway's business; what belongs to this hook is how it
// reads the three answers the gateway can give — yes, no, and "I couldn't ask".
vi.mock('../../infrastructure/httpWorkspaceGateway', () => ({
    httpWorkspaceGateway: { checkSlugAvailable: vi.fn() }
}));

const checkSlugAvailable = vi.mocked(httpWorkspaceGateway.checkSlugAvailable);

/**
 * A client and a wrapper publishing it, as the admin shell would. Retries are
 * off so a rejected check settles as an error on the first attempt instead of
 * sitting in `isFetching` through the retry ladder.
 */
function withQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

/**
 * The wizard's live slug check, and specifically what it does when the check
 * itself fails.
 *
 * `query.data` is `undefined` both before an answer arrives and after the
 * request fails, so the final line — `data === false ? Taken : Available` —
 * reports an outage as the positive answer unless the error is branched out
 * first. That is the expensive direction to be wrong in: the continue gate
 * unblocks, the person spends two more steps on the wizard, and the slug is
 * refused with a `409` at submit, by which point the field that would fix it is
 * two screens back.
 *
 * `useDebouncedValue` seeds its state with the value it is given, so a slug that
 * never changes is already settled on the first render and these tests need no
 * timer control.
 */
describe('useSlugAvailability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reports a failed check as Unknown, never Available', async () => {
        checkSlugAvailable.mockRejectedValue(new Error('network down'));

        const { result } = renderHook(
            () => useSlugAvailability('marketing-site'),
            { wrapper: withQueryClient() }
        );

        await waitFor(() => expect(result.current).toBe(SlugStatus.Unknown));
    });

    it('reports a free slug as Available', async () => {
        checkSlugAvailable.mockResolvedValue(true);

        const { result } = renderHook(
            () => useSlugAvailability('marketing-site'),
            { wrapper: withQueryClient() }
        );

        await waitFor(() => expect(result.current).toBe(SlugStatus.Available));
        expect(checkSlugAvailable).toHaveBeenCalledWith('marketing-site');
    });

    it('reports a slug the server already knows as Taken', async () => {
        checkSlugAvailable.mockResolvedValue(false);

        const { result } = renderHook(
            () => useSlugAvailability('marketing-site'),
            { wrapper: withQueryClient() }
        );

        await waitFor(() => expect(result.current).toBe(SlugStatus.Taken));
    });

    // The two states that never reach the network: nothing typed, and something
    // typed that the shared `Slug` rule already rejects. Asking the server about
    // either is a request whose answer could not change the outcome.
    it('answers the empty and malformed cases without asking the server', () => {
        const wrapper = withQueryClient();

        const { result: empty } = renderHook(() => useSlugAvailability(''), {
            wrapper
        });
        expect(empty.current).toBe(SlugStatus.Empty);

        const { result: invalid } = renderHook(
            () => useSlugAvailability('Marketing Site'),
            { wrapper }
        );
        expect(invalid.current).toBe(SlugStatus.Invalid);

        expect(checkSlugAvailable).not.toHaveBeenCalled();
    });
});
