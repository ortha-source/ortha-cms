import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';
import type {
    SaveAccessRuleInput,
    UpdateAccessRuleInput
} from '../../infrastructure/segmentsGateway';

/** Creates a workspace-scoped rule. */
export function useCreateAccessRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SaveAccessRuleInput) =>
            httpSegmentsGateway.createRule(input),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}

/**
 * Replaces a rule.
 *
 * The invalidation covers the whole workspace's access root, not just the rule
 * list, and that is the point: the server re-projects every target the rule is
 * assigned to before it answers, so by the time this resolves the entries the
 * rule governs are already being served differently. Refreshing only the rules
 * would leave the assignment list — and any entry chip reading it — describing
 * the previous decision.
 */
export function useUpdateAccessRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateAccessRuleInput) =>
            httpSegmentsGateway.updateRule(input),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}

/** Deletes a rule nothing is assigned to. Refused server-side otherwise. */
export function useDeleteAccessRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpSegmentsGateway.deleteRule(id),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.access(workspaceId)
            })
    });
}
