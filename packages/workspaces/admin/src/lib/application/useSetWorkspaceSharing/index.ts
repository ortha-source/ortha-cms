import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Workspace } from '../../domain/types/workspace';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import { workspaceContentAccessRoot } from '../../infrastructure/contentAccessKeys';
import { workspacesKey } from '../useWorkspaces';

/** Turns sharing on or off for one workspace. */
export type SetWorkspaceSharingInput = {
    /** The workspace to (un)share. */
    id: string;
    /** The desired shared state. */
    isShared: boolean;
};

/**
 * Flips a workspace's **shared** flag through the gateway's
 * `PATCH /api/workspaces/:id` — sending `isShared` alone, never alongside the
 * profile form's fields, so neither write can carry a stale copy of the other.
 *
 * The PATCH answers with the canonical workspace, so on success that row is
 * written straight into the workspaces list (`workspacesKey` — the only
 * workspace query there is; the shell, the switcher and the settings page all
 * read it) instead of refetching the whole list for one boolean. With no list
 * cached there is nothing to patch, so it falls back to invalidating that one
 * key.
 *
 * Sharing is the one flag that changes what **other** workspaces can reach —
 * every workspace granted content from this one gains or loses its records —
 * so the content-access family is invalidated for every workspace. Only the
 * mounted queries refetch; the rest are merely marked stale.
 */
export function useSetWorkspaceSharing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isShared }: SetWorkspaceSharingInput) =>
            httpWorkspaceGateway.update({ id, isShared }),
        onSuccess: (updated: Workspace) => {
            void queryClient.invalidateQueries({
                queryKey: workspaceContentAccessRoot
            });
            const cached = queryClient.getQueryData<Workspace[]>(workspacesKey);
            if (!cached) {
                void queryClient.invalidateQueries({ queryKey: workspacesKey });
                return;
            }
            queryClient.setQueryData<Workspace[]>(
                workspacesKey,
                cached.map((workspace) =>
                    workspace.id === updated.id ? updated : workspace
                )
            );
        }
    });
}
