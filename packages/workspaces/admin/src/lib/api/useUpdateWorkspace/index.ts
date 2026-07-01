import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { AvatarColor } from '@ortha-cms/design-system';
import type { Workspace } from '../../types/workspace';
import {
    toWorkspace,
    workspacesKey,
    type WorkspaceView
} from '../useWorkspaces';

/**
 * A partial profile edit: the target workspace id plus any of the editable
 * fields. Only the fields present are sent; the server writes just those.
 */
export type UpdateWorkspaceInput = {
    /** The workspace to edit. */
    id: string;
    /** New display name. */
    name?: string;
    /** New description (an empty string clears it). */
    description?: string;
    /** New accent color. */
    color?: AvatarColor;
};

/** Edits a workspace's profile via `PATCH /api/workspaces/:id`. */
async function updateWorkspace({
    id,
    ...patch
}: UpdateWorkspaceInput): Promise<Workspace> {
    try {
        const { data } = await apiClient.patch<WorkspaceView>(
            `/workspaces/${id}`,
            patch
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Edits a workspace's name / description / color. On success it invalidates the
 * workspaces list so the shell (which reads the open workspace from that list)
 * re-resolves with the new values.
 */
export function useUpdateWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateWorkspace,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
