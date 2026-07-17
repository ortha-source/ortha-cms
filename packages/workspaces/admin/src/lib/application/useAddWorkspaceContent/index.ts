import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { AddWorkspaceContentInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { AddWorkspaceContentInput } from '../../infrastructure/workspaceGateway';

/**
 * Grants a workspace access to a content type via the gateway (idempotent
 * server-side). Invalidates the workspaces list so the granted slug shows in
 * settings and the Content Library scopes to it.
 */
export function useAddWorkspaceContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: AddWorkspaceContentInput) =>
            httpWorkspaceGateway.addContent(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
