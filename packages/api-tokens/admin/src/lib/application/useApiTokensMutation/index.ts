import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpApiTokenGateway } from '../../infrastructure/httpApiTokenGateway';
import { apiTokensKeys } from '../../infrastructure/apiTokensKeys';
import type { CreateApiTokenInput } from '../../infrastructure/apiTokenGateway';

/**
 * Mints a token. On success every cached token page is invalidated (a new row
 * may land on any page). The mutation result carries the one-time plaintext
 * `secret` — the page hands it straight to the reveal dialog.
 */
export function useCreateApiToken() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateApiTokenInput) =>
            httpApiTokenGateway.create(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: apiTokensKeys.all })
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
