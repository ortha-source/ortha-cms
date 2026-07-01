import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../types/workspace';
import {
    toWorkspace,
    workspacesKey,
    type WorkspaceView
} from '../useWorkspaces';

/** Links an existing directory user to a workspace. */
export type AddWorkspaceMemberInput = {
    /** The workspace to add the member to. */
    workspaceId: string;
    /** The directory user id to link. */
    userId: string;
};

/** Adds a member via `POST /api/workspaces/:id/members`. */
async function addWorkspaceMember({
    workspaceId,
    userId
}: AddWorkspaceMemberInput): Promise<Workspace> {
    try {
        const { data } = await apiClient.post<WorkspaceView>(
            `/workspaces/${workspaceId}/members`,
            { userId }
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Adds an existing user to a workspace (idempotent server-side). Invalidates the
 * workspaces list so the member appears in the settings roster.
 */
export function useAddWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: addWorkspaceMember,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
