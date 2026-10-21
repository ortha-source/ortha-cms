import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markJustCreated } from '@orthacms/utils-admin';
import { httpApiTokenGateway } from '../../infrastructure/httpApiTokenGateway';
import { apiTokensKeys } from '../../infrastructure/apiTokensKeys';
import type { CreateApiTokenInput } from '../../infrastructure/apiTokenGateway';

/** The `justCreated` scope of the tokens table. */
export const API_TOKENS_SCOPE = 'api-tokens';

/**
 * Mints a token. On success every cached token page is invalidated (a new row
 * may land on any page). The mutation result carries the one-time plaintext
 * `secret` — the page hands it straight to the reveal dialog.
 *
 * `gcTime: 0` is a security setting, not a performance one. TanStack keeps a
 * settled mutation in its cache for `gcTime` (5 minutes by default) after the
 * last observer detaches, and a mutation cache is not scoped to a route — so at
 * the default the plaintext bearer token would sit in memory long after the
 * dialog that promised "you won't be able to see it again" was dismissed, and
 * follow the user across the whole SPA. Zero drops the entry the moment the
 * page resets or unmounts the mutation.
 */
export function useCreateApiToken() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateApiTokenInput) =>
            httpApiTokenGateway.create(input),
        gcTime: 0,
        onSuccess: (created) => {
            // The table flashes the row the refetch brings in.
            markJustCreated(API_TOKENS_SCOPE, created.id);
            return queryClient.invalidateQueries({
                queryKey: apiTokensKeys.all
            });
        }
    });
}

/** Revokes a token, then invalidates every cached token page. */
export function useRevokeApiToken() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpApiTokenGateway.revoke(id),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: apiTokensKeys.all })
    });
}
