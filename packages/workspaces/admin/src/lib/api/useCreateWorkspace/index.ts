import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { Workspace, WorkspaceMember } from '../../types/workspace';
import type { CreateWorkspaceBody } from '../../types/wizard';
import {
    toWorkspace,
    workspacesKey,
    type WorkspaceView
} from '../useWorkspaces';

/**
 * Arguments to the create mutation: the API request body plus the creator. The
 * server derives the owner from the session and ignores `creator`; it's kept
 * only so the optimistic update can seed a card before the response lands.
 */
export type CreateWorkspaceArgs = {
    body: CreateWorkspaceBody;
    creator: WorkspaceMember;
};

/** Creates a workspace via `POST /api/workspaces` and maps the response. */
async function createWorkspace({
    body
}: CreateWorkspaceArgs): Promise<Workspace> {
    try {
        const { data } = await apiClient.post<WorkspaceView>(
            '/workspaces',
            body
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
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
        onMutate: async ({ body, creator }: CreateWorkspaceArgs) => {
            await queryClient.cancelQueries({ queryKey: workspacesKey });
            const previous =
                queryClient.getQueryData<Workspace[]>(workspacesKey);

            const optimistic: Workspace = {
                // A unique id so two same-named creates can't collide on their
                // React key; reconciled away when `onSettled` refetches.
                id: `optimistic_${crypto.randomUUID()}`,
                slug: body.slug,
                name: body.name,
                description: body.description,
                color: body.color,
                status: 'Active',
                members: [creator],
                // Grants are resolved server-side; reconciled when onSettled refetches.
                content: []
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
