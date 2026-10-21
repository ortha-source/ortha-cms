import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markJustCreated } from '@orthacms/utils-admin';
import type { Workspace, WorkspaceMember } from '../../domain/types/workspace';
import type { CreateWorkspaceBody } from '../../domain/types/wizard';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import { workspacesKey } from '../useWorkspaces';

/**
 * Arguments to the create mutation: the API request body plus the creator. The
 * server derives the owner from the session and ignores `creator`; it's kept
 * only so the optimistic update can seed a card before the response lands.
 */
export type CreateWorkspaceArgs = {
    body: CreateWorkspaceBody;
    creator: WorkspaceMember;
};

/** The `justCreated` scope of the workspaces table. */
export const WORKSPACES_SCOPE = 'workspaces';

/**
 * Creates a workspace and optimistically inserts it at the top of the list, so
 * the new card appears the instant the form is submitted. Rolls back on error
 * and reconciles with the server result on settle.
 *
 * On success the stub is swapped for the server's workspace in place and its
 * real id is marked as just created: the wizard navigates to the list next, and
 * the row it lands on — keyed by that id, so it does not remount when the
 * settle refetch arrives — is the one highlighted.
 */
export function useCreateWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ body }: CreateWorkspaceArgs): Promise<Workspace> =>
            httpWorkspaceGateway.create(body),
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
                content: [],
                // A new workspace is never shared; sharing is a settings toggle.
                isShared: false,
                // Resolved server-side too; reconciled by the same refetch.
                sharedContent: []
            };
            queryClient.setQueryData<Workspace[]>(workspacesKey, (old = []) => [
                optimistic,
                ...old
            ]);

            return { previous, optimisticId: optimistic.id };
        },
        onSuccess: (created, _input, context) => {
            queryClient.setQueryData<Workspace[]>(workspacesKey, (old) =>
                old?.map((workspace) =>
                    workspace.id === context?.optimisticId ? created : workspace
                )
            );
            markJustCreated(WORKSPACES_SCOPE, created.id);
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
