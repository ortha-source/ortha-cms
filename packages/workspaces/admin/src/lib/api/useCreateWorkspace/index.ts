import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createWorkspace,
    type CreateWorkspaceInput
} from '../workspacesClient';
import { workspacesKey } from '../useWorkspaces';
import type { Workspace } from '../../types/workspace';

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
