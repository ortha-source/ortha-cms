import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { Workspace, WorkspaceStatus } from '../../types/workspace';
import {
    toWorkspace,
    workspacesKey,
    type WorkspaceView
} from '../useWorkspaces';

/** The target lifecycle status for a workspace. */
export type SetWorkspaceStatusInput = {
    /** The workspace to archive/unarchive. */
    id: string;
    /** The desired status. */
    status: WorkspaceStatus;
};

/**
 * Archives or unarchives a workspace via `POST /api/workspaces/:id/archive`
 * (resp. `/unarchive`) — the route is chosen from the target status.
 */
async function setWorkspaceStatus({
    id,
    status
}: SetWorkspaceStatusInput): Promise<Workspace> {
    const action = status === 'Archived' ? 'archive' : 'unarchive';
    try {
        const { data } = await apiClient.post<WorkspaceView>(
            `/workspaces/${id}/${action}`
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Flips a workspace between active and archived. Invalidates the workspaces list
 * on success so the shell and grid reflect the new status.
 */
export function useSetWorkspaceStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: setWorkspaceStatus,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
