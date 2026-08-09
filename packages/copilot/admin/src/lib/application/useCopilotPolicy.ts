import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@ortha-cms/utils-admin';

/** A `propose` tool an admin may opt into auto-apply. */
export interface CopilotOptInCandidate {
    /** The tool's name, e.g. `media_propose_alt_text`. */
    name: string;
    /** The description the model sees — the most honest label available. */
    description: string;
}

/** The workspace's copilot policy, plus what could be opted in. */
export interface CopilotPolicy {
    /** Tool names allowed to write directly instead of proposing. */
    autoApplyTools: string[];
    /** Every `propose` tool this deployment bound, for the checkbox list. */
    optInCandidates: CopilotOptInCandidate[];
}

/** Query key for one workspace's copilot policy. */
export function copilotPolicyKey(workspaceId: string) {
    return ['copilot', 'policy', workspaceId] as const;
}

/**
 * Reads the workspace's auto-apply policy.
 *
 * `copilot:configure`-gated server-side, so this 403s for an editor — the
 * caller renders the page only for someone who holds the key, and the query is
 * the second line rather than the first.
 */
export function useCopilotPolicy(workspaceId: string, enabled = true) {
    return useQuery({
        queryKey: copilotPolicyKey(workspaceId),
        queryFn: async (): Promise<CopilotPolicy> => {
            const response = await apiClient.get<CopilotPolicy>(
                '/copilot/policy',
                { headers: { 'X-Workspace-Id': workspaceId } }
            );
            return response.data;
        },
        // Configuration, not content: it changes when an admin changes it, so
        // a long window costs nothing and a refetch per navigation buys
        // nothing.
        staleTime: STALE_TIME.Standard,
        enabled
    });
}

/**
 * Replaces the workspace's auto-apply list.
 *
 * A **replace, not a patch**, mirroring the route: clearing every opt-in has to
 * be expressible, and a merge would make that impossible without a second call.
 * The response is written straight into the cache rather than triggering a
 * refetch — the server returns the canonical (de-duplicated, sorted, filtered)
 * list, so the round trip would only re-read what we already hold.
 */
export function useSetCopilotPolicy(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (
            autoApplyTools: string[]
        ): Promise<CopilotPolicy> => {
            const response = await apiClient.put<CopilotPolicy>(
                '/copilot/policy',
                { autoApplyTools },
                { headers: { 'X-Workspace-Id': workspaceId } }
            );
            return response.data;
        },
        onSuccess: (policy) => {
            queryClient.setQueryData(copilotPolicyKey(workspaceId), policy);
        }
    });
}
