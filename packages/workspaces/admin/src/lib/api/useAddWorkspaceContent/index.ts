import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../types/workspace';
import {
    toWorkspace,
    workspacesKey,
    type WorkspaceView
} from '../useWorkspaces';

/** Grants a workspace access to one content type. */
export type AddWorkspaceContentInput = {
    /** The workspace to grant. */
    workspaceId: string;
    /** The content-type slug to grant. */
    slug: string;
};

/** Grants content access via `POST /api/workspaces/:id/content`. */
async function addWorkspaceContent({
    workspaceId,
    slug
}: AddWorkspaceContentInput): Promise<Workspace> {
    try {
        const { data } = await apiClient.post<WorkspaceView>(
            `/workspaces/${workspaceId}/content`,
            { slug }
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Grants a workspace access to a content type (idempotent server-side).
 * Invalidates the workspaces list so the granted slug shows in settings and the
 * Content Library scopes to it.
 */
export function useAddWorkspaceContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: addWorkspaceContent,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
