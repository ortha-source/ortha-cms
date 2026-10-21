import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markJustCreated } from '@orthacms/utils-admin';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { AddWorkspaceMemberInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { AddWorkspaceMemberInput } from '../../infrastructure/workspaceGateway';

/**
 * The `justCreated` scope of one workspace's members roster. Its ids are user
 * ids — the key each roster row renders with.
 */
export const workspaceMembersScope = (workspaceId: string) =>
    `workspace-members:${workspaceId}`;

/**
 * Adds an existing user to a workspace via the gateway (idempotent server-side).
 * Invalidates the workspaces list so the member appears in the settings roster,
 * and marks them so that row is highlighted when it arrives.
 */
export function useAddWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: AddWorkspaceMemberInput) =>
            httpWorkspaceGateway.addMember(input),
        onSuccess: (_workspace, { workspaceId, userId }) => {
            markJustCreated(workspaceMembersScope(workspaceId), userId);
            return queryClient.invalidateQueries({ queryKey: workspacesKey });
        }
    });
}
