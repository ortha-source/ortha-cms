import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { resetSessionCache } from './index';

/** A client holding one cached value per key, as a signed-in session would. */
function clientWith(entries: [readonly unknown[], unknown][]): QueryClient {
    const queryClient = new QueryClient();
    for (const [queryKey, data] of entries) {
        queryClient.setQueryData(queryKey, data);
    }
    return queryClient;
}

/**
 * The sweep that runs whenever the identity behind a tab changes — signing in,
 * signing out, accepting an invite.
 *
 * What it protects is not staleness but leakage: every non-`auth` key in the
 * cache was filled on behalf of whoever was signed in a moment ago, so anything
 * left behind is one account's data sitting in another account's session until
 * each query happens to refetch. The two halves of the rule are equally load
 * bearing — sweep too little and the previous occupant's roster is still in
 * memory; sweep too much and the caller loses the very query (or mutation) it
 * is calling this from.
 */
describe('resetSessionCache', () => {
    it('drops everything the outgoing session cached', () => {
        const queryClient = clientWith([
            [['workspaces'], [{ id: 'ws_1' }]],
            [['users'], [{ id: 'usr_1' }]],
            [['activity'], [{ id: 'act_1' }]]
        ]);

        resetSessionCache(queryClient);

        expect(queryClient.getQueryData(['workspaces'])).toBeUndefined();
        expect(queryClient.getQueryData(['users'])).toBeUndefined();
        expect(queryClient.getQueryData(['activity'])).toBeUndefined();
    });

    it('keeps the current-user probe, which the caller re-seeds itself', () => {
        const queryClient = clientWith([
            [['auth', 'me'], { id: 'usr_1' }],
            [['workspaces'], [{ id: 'ws_1' }]]
        ]);

        resetSessionCache(queryClient);

        expect(queryClient.getQueryData(['auth', 'me'])).toEqual({
            id: 'usr_1'
        });
    });

    // The predicate looks at `queryKey[0]` alone, so the whole `auth` namespace
    // survives — not just the probe. That is what an invite acceptance needs:
    // it changes the identity (and so sweeps) while the page it is rendering
    // still reads the invite it is redeeming.
    it.each([
        ['an invite lookup', ['auth', 'invite', 'tok_1'] as const],
        ['the SSO provider list', ['auth', 'sso', 'providers'] as const]
    ])('keeps %s', (_case, queryKey) => {
        const queryClient = clientWith([
            [queryKey, { kept: true }],
            [['workspaces'], [{ id: 'ws_1' }]]
        ]);

        resetSessionCache(queryClient);

        expect(queryClient.getQueryData(queryKey)).toEqual({ kept: true });
        expect(queryClient.getQueryData(['workspaces'])).toBeUndefined();
    });

    // The means matter, not only the result: `clear()` would empty the query
    // cache too, but it also wipes the *mutation* cache — including the
    // sign-in/sign-out mutation whose `onSuccess` is calling this. That
    // mutation would be observing a record that no longer exists, and the form
    // that fired it never settles.
    it('sweeps with removeQueries rather than clearing the client', () => {
        const queryClient = new QueryClient();
        const removeQueries = vi.spyOn(queryClient, 'removeQueries');
        const clear = vi.spyOn(queryClient, 'clear');

        resetSessionCache(queryClient);

        expect(removeQueries).toHaveBeenCalledOnce();
        expect(clear).not.toHaveBeenCalled();
    });

    it('leaves the mutation cache untouched', () => {
        const queryClient = clientWith([[['workspaces'], [{ id: 'ws_1' }]]]);
        const mutation = queryClient.getMutationCache().build(queryClient, {
            mutationFn: async () => undefined
        });

        resetSessionCache(queryClient);

        expect(queryClient.getMutationCache().getAll()).toContain(mutation);
        // Contrast: the API that *would* have taken it with it.
        queryClient.clear();
        expect(queryClient.getMutationCache().getAll()).toEqual([]);
    });
});
