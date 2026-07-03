import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../types/workspace';
import {
    toWorkspace,
    workspacesKey,
    type WorkspaceView
} from '../useWorkspaces';

/** Revokes a workspace's access to one content type. */
export type RemoveWorkspaceContentInput = {
    /** The workspace to revoke from. */
    workspaceId: string;
    /** The content-type slug to revoke. */
    slug: string;
};

/**
 * Revokes content access via `DELETE /api/workspaces/:id/content/:slug`. The
 * server refuses with `409` when the type still holds entries in the workspace;
 * the caller reads `ApiError.status` to show the "not empty" message.
 */
async function removeWorkspaceContent({
    workspaceId,
    slug
}: RemoveWorkspaceContentInput): Promise<Workspace> {
    try {
        const { data } = await apiClient.delete<WorkspaceView>(
            `/workspaces/${workspaceId}/content/${slug}`
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Revokes a workspace's access to a content type — only when it's empty
 * (a `409` otherwise, surfaced via the thrown {@link ApiError}). Invalidates the
 * workspaces list on success.
 */
export function useRemoveWorkspaceContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: removeWorkspaceContent,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
