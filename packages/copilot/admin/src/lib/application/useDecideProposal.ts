import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { ChatProposal } from '../domain/types/chat';

/** One proposal as the server returns it from accept / reject. */
export interface DecidedProposal {
    id: string;
    status: ChatProposal['status'];
    result: { entityId?: string } | null;
    error: string | null;
}

/** What the panel asks for. */
export interface DecideProposalInput {
    proposalId: string;
    decision: 'accept' | 'reject';
    workspaceId: string;
}

/**
 * Accepts or rejects one proposal.
 *
 * A **mutation, not a query**: it is an explicit user action whose result is
 * folded into the panel's reducer rather than rendered from cache — the same
 * shape `useOpenConversation` uses, for the same reason.
 *
 * Errors are deliberately **not** swallowed here. The four the server can
 * return each mean something different to the person clicking (409 someone got
 * there first, 403 you may not, 422 it could not be applied and is still
 * pending, 404 it is gone), so the card reads the status and says which —
 * collapsing them into "failed" would lose exactly the information that tells
 * the user whether to retry, refresh, or ask someone else.
 */
export function useDecideProposal() {
    return useMutation({
        mutationFn: async ({
            proposalId,
            decision,
            workspaceId
        }: DecideProposalInput) => {
            const response = await apiClient.post<DecidedProposal>(
                `/copilot/proposals/${proposalId}/${decision}`,
                undefined,
                { headers: { 'X-Workspace-Id': workspaceId } }
            );
            return response.data;
        }
    });
}
