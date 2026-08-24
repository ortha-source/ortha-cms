import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { alarmsKeys } from '../../infrastructure/alarmsKeys';
import { httpAlarmsGateway } from '../../infrastructure/httpAlarmsGateway';

/** Identifies one finding — the pair its primary key is made of. */
export type FindingRef = {
    ruleId: string;
    entryId: string;
};

/**
 * Silences one finding.
 *
 * The reason is optional in the contract and asked for in the UI: a mute with
 * no reason is indistinguishable from giving up, and the next person to read
 * the finding has no way to tell whether the exception was considered.
 */
export function useMuteFinding() {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation({
        mutationFn: ({
            ruleId,
            entryId,
            reason
        }: FindingRef & { reason?: string }) =>
            httpAlarmsGateway.mute(ruleId, entryId, reason),
        onSuccess: () => {
            // A mute moves the finding between the Open and Muted tabs, changes
            // the rule's two counts and the summary badge — every alarms cache
            // in the workspace. There is no narrower placement worth the
            // bookkeeping.
            queryClient.invalidateQueries({
                queryKey: alarmsKeys.all(workspace.id)
            });
        }
    });
}

/** Lifts a mute, putting a still-matching finding back in view. */
export function useUnmuteFinding() {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation({
        mutationFn: ({ ruleId, entryId }: FindingRef) =>
            httpAlarmsGateway.unmute(ruleId, entryId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: alarmsKeys.all(workspace.id)
            });
        }
    });
}
