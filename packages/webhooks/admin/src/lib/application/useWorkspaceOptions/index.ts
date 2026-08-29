import { useQuery } from '@tanstack/react-query';
import { httpWebhookGateway } from '../../infrastructure/httpWebhookGateway';

/** How long the workspace list is treated as fresh inside the editor. */
const OPTIONS_STALE_TIME_MS = 60_000;

/**
 * Every workspace, for the endpoint editor's picker.
 *
 * Requires `workspaces:read`, which every role holds — but the caller still
 * passes `enabled`, because the picker only exists inside a dialog and there is
 * no reason to fetch before it opens.
 */
export function useWorkspaceOptions(enabled = true) {
    return useQuery({
        queryKey: ['webhooks', 'workspace-options'] as const,
        queryFn: () => httpWebhookGateway.listWorkspaceOptions(),
        staleTime: OPTIONS_STALE_TIME_MS,
        enabled
    });
}
