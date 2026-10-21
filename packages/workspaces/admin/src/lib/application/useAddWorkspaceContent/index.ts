import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markJustCreated } from '@orthacms/utils-admin';
import { grantKey } from '../../domain/grantKey';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { AddWorkspaceContentInput } from '../../infrastructure/workspaceGateway';
import { workspaceContentAccessKey } from '../../infrastructure/contentAccessKeys';
import { workspacesKey } from '../useWorkspaces';

export type { AddWorkspaceContentInput } from '../../infrastructure/workspaceGateway';

/**
 * The `justCreated` scope of one workspace's granted-content list. Its ids are
 * {@link grantKey}s — the key each granted row renders with.
 */
export const workspaceContentScope = (workspaceId: string) =>
    `workspace-content:${workspaceId}`;

/**
 * Grants a workspace access to a content type via the gateway (idempotent
 * server-side). Invalidates the workspaces list so the granted slug shows in
 * settings and the Content Library scopes to it, and marks the grant so the
 * row the refetch brings in is highlighted.
 */
export function useAddWorkspaceContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: AddWorkspaceContentInput) =>
            httpWorkspaceGateway.addContent(input),
        onSuccess: (_workspace, { workspaceId, slug, sourceWorkspaceId }) => {
            markJustCreated(
                workspaceContentScope(workspaceId),
                grantKey(slug, sourceWorkspaceId)
            );
            // What this workspace can reach just changed: its content-type
            // list (`access`) and its shared-sources catalogue. Not awaited —
            // the grant has landed, and the dialog shouldn't wait on the nav's
            // refetch to close.
            void queryClient.invalidateQueries({
                queryKey: workspaceContentAccessKey(workspaceId)
            });
            return queryClient.invalidateQueries({ queryKey: workspacesKey });
        }
    });
}
