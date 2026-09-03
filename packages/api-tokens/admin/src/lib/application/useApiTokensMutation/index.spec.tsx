import {
    QueryClient,
    QueryClientProvider,
    useMutation
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatedApiToken } from '../../domain/types/apiToken';
import type { CreateApiTokenInput } from '../../infrastructure/apiTokenGateway';
import { httpApiTokenGateway } from '../../infrastructure/httpApiTokenGateway';
import { useCreateApiToken } from './index';

// The request itself is the gateway's business. What belongs to this hook is
// what TanStack is told to do with the *answer* — which happens to be a bearer
// token in plaintext.
vi.mock('../../infrastructure/httpApiTokenGateway', () => ({
    httpApiTokenGateway: { create: vi.fn(), revoke: vi.fn() }
}));

const create = vi.mocked(httpApiTokenGateway.create);

const SECRET = 'ort_live_supersecret';

const INPUT: CreateApiTokenInput = {
    name: 'Production website',
    workspaceIds: ['ws_1'],
    scope: 'read'
};

const minted: CreatedApiToken = {
    id: 'tok_1',
    name: 'Production website',
    workspaceIds: ['ws_1'],
    scope: 'read',
    lookupPrefix: 'ort_a1b2c3',
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    status: 'active',
    secret: SECRET
};

/** A client and the provider the admin shell would publish it through. */
function withQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } }
    });

    return {
        queryClient,
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    };
}

/** The plaintext the client is still holding, one entry per settled mutation. */
const cachedSecrets = (queryClient: QueryClient) =>
    queryClient
        .getMutationCache()
        .getAll()
        .map(
            (mutation) =>
                (mutation.state.data as CreatedApiToken | undefined)?.secret
        );

/**
 * Minting a token. The mutation *result* is the one-time plaintext credential,
 * so how long TanStack keeps it is a security setting rather than a tuning one:
 * a mutation cache is not scoped to a route, and at the default `gcTime` the
 * secret would sit in memory for five minutes after the dialog that promised
 * "you won't be able to see it again" was dismissed, following the user across
 * the whole SPA.
 *
 * It is asserted twice on purpose — once as the effect (the entry is gone the
 * moment the last observer detaches) and once as the declared value, because
 * a sweep observed inside a test cannot tell `gcTime: 0` apart from a shorter
 * non-zero default that simply has not elapsed yet.
 */
describe('useCreateApiToken', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        create.mockResolvedValue(minted);
    });

    it('drops the plaintext from the mutation cache as soon as the page lets go [api-tokens:I-03]', async () => {
        const { queryClient, wrapper } = withQueryClient();
        const { result, unmount } = renderHook(() => useCreateApiToken(), {
            wrapper
        });

        await act(async () => {
            await result.current.mutateAsync(INPUT);
        });

        // Precondition: the credential really is in the cache while the reveal
        // dialog needs it — otherwise the assertion below proves nothing.
        expect(cachedSecrets(queryClient)).toEqual([SECRET]);

        unmount();

        await waitFor(() => expect(cachedSecrets(queryClient)).toEqual([]));
    });

    it('declares gcTime: 0 rather than leaning on the default five minutes', async () => {
        const { queryClient, wrapper } = withQueryClient();
        const { result } = renderHook(() => useCreateApiToken(), { wrapper });

        await act(async () => {
            await result.current.mutateAsync(INPUT);
        });

        // Read off the mutation TanStack built for this hook. The number is the
        // whole assertion: a merely *short* gcTime would still look swept in the
        // test above, while leaving the secret resident for that long in a
        // browser.
        const [mutation] = queryClient.getMutationCache().getAll();
        expect(mutation.options.gcTime).toBe(0);
    });

    // The control for the first test: an otherwise identical mutation that does
    // *not* set `gcTime` still holds its result after unmount. Without this, a
    // TanStack change that swept every settled mutation would leave the sweep
    // test green whether or not this hook still asked for it.
    it('is that option doing the work, not TanStack default behaviour', async () => {
        const { queryClient, wrapper } = withQueryClient();
        const { result, unmount } = renderHook(
            () =>
                useMutation({
                    mutationFn: () => httpApiTokenGateway.create(INPUT)
                }),
            { wrapper }
        );

        await act(async () => {
            await result.current.mutateAsync();
        });
        unmount();

        expect(cachedSecrets(queryClient)).toEqual([SECRET]);
    });
});
