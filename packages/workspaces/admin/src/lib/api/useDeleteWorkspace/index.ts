import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { workspacesKey } from '../useWorkspaces';

/** Permanently deletes a workspace via `DELETE /api/workspaces/:id`. */
async function deleteWorkspace(id: string): Promise<void> {
    try {
        await apiClient.delete(`/workspaces/${id}`);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Permanently deletes a workspace. On success it invalidates the workspaces
 * list so the deleted workspace drops out of the grid; the caller navigates away
 * from the (now-gone) shell route.
 *
 * `onSuccess` deliberately does **not** return the `invalidateQueries` promise:
 * awaiting it would delay `mutateAsync` until the list refetches without this
 * workspace, so the shell would re-render and flash its "workspace not found"
 * state before the caller's `navigate('/workspaces')` runs. Firing the
 * invalidation without awaiting lets the caller redirect first.
 */
export function useDeleteWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteWorkspace,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: workspacesKey });
        }
    });
}
