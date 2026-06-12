import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { AvatarColor } from '@ortha-cms/design-system';
import {
    workspacesKey,
    toWorkspace,
    type WorkspaceResponse
} from '../useWorkspaces';
import type { Workspace, WorkspaceMember } from '../../types/workspace';

/** The shape the create form submits. The creator becomes the sole member. */
export type CreateWorkspaceInput = {
    name: string;
    description: string;
    color: AvatarColor;
    creator: WorkspaceMember;
};

// TODO(workspaces-create): the server is read-only today (no POST /workspaces),
// so the create entry point is hidden in the UI (see WorkspacesPage). When the
// create endpoint ships, this POST is the seam — the server derives the owner
// from the session, so `input.creator` is used only for the optimistic insert.
/** Creates a workspace. Dormant until the server's create endpoint ships. */
async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const { data } = await apiClient.post<WorkspaceResponse>('/workspaces', {
        name: input.name,
        description: input.description,
        color: input.color
    });
    return toWorkspace(data);
}

/**
 * Creates a workspace and optimistically inserts it at the top of the list, so
 * the new card appears the instant the form is submitted. Rolls back on error
 * and reconciles with the server result on settle.
 */
export function useCreateWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createWorkspace,
        onMutate: async (input: CreateWorkspaceInput) => {
            await queryClient.cancelQueries({ queryKey: workspacesKey });
            const previous =
                queryClient.getQueryData<Workspace[]>(workspacesKey);

            const optimistic: Workspace = {
                // A unique id so two same-named creates can't collide on their
                // React key; reconciled away when `onSettled` refetches.
                id: `optimistic_${crypto.randomUUID()}`,
                name: input.name,
                description: input.description,
                color: input.color,
                status: 'Active',
                members: [input.creator]
            };
            queryClient.setQueryData<Workspace[]>(workspacesKey, (old = []) => [
                optimistic,
                ...old
            ]);

            return { previous };
        },
        onError: (_error, _input, context) => {
            if (context?.previous) {
                queryClient.setQueryData(workspacesKey, context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: workspacesKey });
        }
    });
}
