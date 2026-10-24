import { useCallback } from 'react';
import { useAddWorkspaceMember } from '../useAddWorkspaceMember';

/** How an add-to-workspaces run went. */
export type AddToWorkspacesResult = {
    /** How many memberships were created. */
    added: number;
    /** How many failed. */
    failed: number;
};

/**
 * Adds one member to several workspaces — the Overview card's and the
 * Workspaces tab's "Add". Each workspace is added independently, so one
 * failure (an already-member race, a transient error) doesn't mask the ones
 * that committed; `Promise.all` would reject on the first and report a total
 * failure even though some adds succeeded.
 */
export function useAddToWorkspaces(memberId: string) {
    const addMember = useAddWorkspaceMember();
    const add = useCallback(
        async (workspaceIds: string[]): Promise<AddToWorkspacesResult> => {
            const results = await Promise.allSettled(
                workspaceIds.map((workspaceId) =>
                    addMember.mutateAsync({ userId: memberId, workspaceId })
                )
            );
            const added = results.filter(
                (result) => result.status === 'fulfilled'
            ).length;
            return { added, failed: workspaceIds.length - added };
        },
        [addMember, memberId]
    );
    return { add, isPending: addMember.isPending };
}
