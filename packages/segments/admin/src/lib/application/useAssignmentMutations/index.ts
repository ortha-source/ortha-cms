import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';
import type {
    AssignRuleInput,
    GrantAccessInput
} from '../../infrastructure/segmentsGateway';

/**
 * Assigns a rule to a level, replacing whatever was on that target.
 *
 * Replace, not add: one rule governs a level, and two would make "which applies
 * here" an ordering question no editor could predict. The dialogs say so; this
 * is where the consequence lands, because a successful assign silently removes
 * the assignment the user may have been looking at a moment ago.
 */
export function useAssignRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: AssignRuleInput) =>
            httpSegmentsGateway.assign(input),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}

/** Removes an assignment; the server re-projects what it used to govern. */
export function useUnassignRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpSegmentsGateway.unassign(id),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}

/**
 * Grants a segment access to a level — the segment side of the declaration.
 *
 * A grant only ever widens: it becomes one more OR-ed condition group and it
 * carries no mode. "Everyone except this one" from this side would be every
 * segment but one, so exclusions stay on the content side, in a rule. That is
 * why this hook takes no mode to pass on.
 */
export function useGrantAccess(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: GrantAccessInput) =>
            httpSegmentsGateway.grant(input),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}

/** Revokes a grant; the server re-projects. */
export function useRevokeGrant(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpSegmentsGateway.revokeGrant(id),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}
