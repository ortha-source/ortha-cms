import type { QueryClient } from '@tanstack/react-query';

/**
 * The query-key namespace this plugin owns — the current-user probe
 * (`['auth','me']`) and the invite lookups (`['auth','invite',token]`). Every
 * other key in the cache was filled on behalf of whoever was signed in.
 */
const IDENTITY_NAMESPACE = 'auth';

/**
 * Drops everything the outgoing session cached, leaving only this plugin's own
 * `auth` keys — the caller owns those and either re-seeds (`logout` writes
 * `null` into the probe) or invalidates them (`login` refetches it).
 *
 * Call it wherever the identity behind this tab changes: signing out, signing
 * in, and accepting an invite. Without it the members roster, workspaces,
 * activity and preferences of the previous account stay in memory for the whole
 * page load, and the next person to sign in on this tab inherits them until
 * each query refetches — a stale-data bug in the best case, and one account's
 * data sitting in another's session in the worst.
 *
 * `removeQueries` rather than `queryClient.clear()`: `clear()` also wipes the
 * mutation cache, including the sign-in/sign-out mutation that is calling this
 * from its own `onSuccess`.
 */
export function resetSessionCache(queryClient: QueryClient): void {
    queryClient.removeQueries({
        predicate: ({ queryKey }) => queryKey[0] !== IDENTITY_NAMESPACE
    });
}
