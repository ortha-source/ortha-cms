import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import {
    QueryClient,
    QueryClientProvider,
    useQuery
} from '@tanstack/react-query';
import {
    useContentPipeline,
    useContentPunchcard,
    useContentStale,
    useContentTotals,
    useContentUnshipped,
    useContentVelocity
} from './index';

/**
 * How many times an Insights query is allowed to ask before it gives up.
 *
 * This pins an invariant of the **Insights page**
 * (`docs/artifacts/insights.html`), which owns the reasoning: the page's whole
 * premise is that one card fails on its own, and TanStack's default of three
 * attempts with exponential backoff leaves a broken card sitting on a skeleton
 * for about seven seconds first — which reads as a hang, not as a failure. The
 * queries themselves live here, in the package that owns the data, so this is
 * where the count is observable.
 *
 * Nothing else states it. The e2e suite can see a failed card but not how many
 * requests were spent reaching it, and reverting every `retry: 1` in this file
 * to the default broke no test anywhere.
 */

const gateway = vi.hoisted(() => ({
    totals: vi.fn(),
    stale: vi.fn(),
    pipeline: vi.fn(),
    unshipped: vi.fn(),
    velocity: vi.fn(),
    punchcard: vi.fn()
}));

vi.mock('../../infrastructure/httpContentInsightsGateway', () => ({
    httpContentInsightsGateway: gateway
}));

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({ id: 'workspace-1', name: 'Docs' })
}));

const permission = vi.hoisted(() => ({ granted: true }));

vi.mock('@orthacms/identity-admin', () => ({
    useHasPermission: () => permission.granted
}));

/**
 * A client that keeps TanStack's own `retry` default (three) and only collapses
 * the backoff, so the number of attempts is the hook's decision and the test
 * still finishes in milliseconds.
 */
function client() {
    return new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } }
    });
}

const wrapper = (queryClient: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    };

const hooks = [
    ['totals', useContentTotals, gateway.totals],
    ['stale', useContentStale, gateway.stale],
    ['pipeline', useContentPipeline, gateway.pipeline],
    ['unshipped', useContentUnshipped, gateway.unshipped],
    ['velocity', useContentVelocity, gateway.velocity],
    ['punchcard', useContentPunchcard, gateway.punchcard]
] as const;

beforeEach(() => {
    permission.granted = true;
    for (const fn of Object.values(gateway)) {
        fn.mockReset();
        fn.mockRejectedValue(new Error('insights endpoint is down'));
    }
});

describe('content Insights queries', () => {
    it.each(hooks)(
        '%s asks twice and then reports failure [insights:I-16]',
        async (_name, hook, request) => {
            const queryClient = client();
            const { result } = renderHook(() => hook(), {
                wrapper: wrapper(queryClient)
            });

            await waitFor(() => expect(result.current.isError).toBe(true));

            // One initial attempt plus one retry. Four would be TanStack's
            // default, and the card would still be on its skeleton.
            expect(request).toHaveBeenCalledTimes(2);
        }
    );

    it.each(hooks)(
        '%s sends nothing without content:read [insights:I-09]',
        async (_name, hook, request) => {
            permission.granted = false;
            const queryClient = client();

            const { result } = renderHook(() => hook(), {
                wrapper: wrapper(queryClient)
            });

            // The gate is checked twice for different reasons: the slot item's
            // `permission` keeps the card (and its band heading) off the page,
            // and `enabled` keeps the request off the wire even if the
            // component is mounted some other way. Only the first half is
            // visible to a browser test, because a gated widget never mounts.
            // A settling window a real request would not survive: with
            // `enabled` gone the query fires on mount, and one macrotask is
            // more than the mocked gateway needs to be called.
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(request).not.toHaveBeenCalled();
            expect(result.current.fetchStatus).toBe('idle');
            expect(result.current.isPending).toBe(true);
        }
    );

    it('is measured against a client that would otherwise retry three times [insights:I-16]', async () => {
        // The control the count above depends on: if the QueryClient itself
        // disabled retries, every assertion above would read 1 attempt and pass
        // for a reason that has nothing to do with the hooks.
        const queryClient = client();
        const request = vi
            .fn()
            .mockRejectedValue(new Error('insights endpoint is down'));

        const { result } = renderHook(
            () =>
                useQuery({
                    queryKey: ['control'],
                    queryFn: request
                }),
            { wrapper: wrapper(queryClient) }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(request).toHaveBeenCalledTimes(4);
    });
});
