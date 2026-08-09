import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { ModelContentBlock } from '@ortha-cms/copilot-domain';
import type {
    ChatMessage,
    ChatProposal,
    ChatToolStep
} from '../domain/types/chat';
import type { CopilotConversation } from './useConversations';

/** One persisted turn, as the transcript route serves it. */
interface PersistedMessage {
    id: string;
    runId: string;
    role: 'user' | 'assistant';
    content: ModelContentBlock[];
    stopReason: string | null;
}

interface ConversationDetail {
    conversation: CopilotConversation;
    messages: PersistedMessage[];
}

/**
 * Opens a persisted thread.
 *
 * A **mutation, not a query**: opening a thread is an explicit user action with
 * a target that changes per invocation, and its result is folded into the
 * panel's reducer rather than rendered from cache. Modelling it as a query
 * would mean a key per thread and a cache that has to be invalidated on every
 * turn to stay honest.
 */
export function useOpenConversation() {
    return useMutation({
        mutationFn: async (conversationId: string) => {
            // Two reads, concurrently. The proposals are a separate table and a
            // separate route, and a thread with no changes in it must not pay
            // for a serial round trip to learn that.
            const [detail, proposals] = await Promise.all([
                apiClient.get<ConversationDetail>(
                    `/copilot/conversations/${conversationId}`
                ),
                apiClient.get<{ items: PersistedProposal[] }>(
                    '/copilot/proposals',
                    { params: { conversationId } }
                )
            ]);
            return {
                conversation: detail.data.conversation,
                messages: toChatMessages(
                    detail.data.messages,
                    proposals.data.items
                )
            };
        }
    });
}

/** One proposal as the queue route serves it. */
interface PersistedProposal {
    id: string;
    toolCallId: string;
    toolName: string;
    kind: string;
    summary: string;
    target: Record<string, unknown>;
    changes: ChatProposal['changes'] | null;
    status: ChatProposal['status'];
    result: { entityId?: string } | null;
    /** Why the change did not apply, when it didn't. */
    error: string | null;
}

/**
 * Persisted turns → the panel's transcript shape.
 *
 * The stored form is the model port's content blocks, which is what makes a
 * transcript survive a provider switch — but it is not what the UI draws. The
 * mapping is one-way and lossy on purpose: `tool_result` blocks are folded onto
 * the `tool_use` step they answer, so a reopened thread renders the same
 * collapsed steps a live run does.
 */
function toChatMessages(
    messages: PersistedMessage[],
    proposals: PersistedProposal[] = []
): ChatMessage[] {
    // Proposals attach by the tool call that produced them, so a reopened
    // thread puts each card back on the turn it belongs to instead of
    // collecting them all at the bottom. `toolCallId` is exactly why the server
    // stores it.
    const proposalsByCall = new Map<string, ChatProposal[]>();
    for (const proposal of proposals) {
        const list = proposalsByCall.get(proposal.toolCallId) ?? [];
        list.push({
            id: proposal.id,
            toolCallId: proposal.toolCallId,
            toolName: proposal.toolName,
            kind: proposal.kind,
            summary: proposal.summary,
            target: proposal.target,
            ...(proposal.changes ? { changes: proposal.changes } : {}),
            status: proposal.status,
            ...(proposal.result?.entityId
                ? { entityId: proposal.result.entityId }
                : {}),
            // A reopened thread must still say a change failed. The card reads
            // `pending` as "did not apply" (ADR-0009), and without the reason
            // it could only say so generically.
            ...(proposal.error ? { error: proposal.error } : {})
        });
        proposalsByCall.set(proposal.toolCallId, list);
    }

    // Tool results ride on the *following* user turn, so collect them all first
    // and attach by id rather than trying to pair them positionally.
    const resultsById = new Map<
        string,
        { content: string; isError?: boolean }
    >();
    for (const message of messages) {
        for (const block of message.content) {
            if (block.type === 'tool_result') {
                resultsById.set(block.toolUseId, {
                    content: block.content,
                    isError: block.isError
                });
            }
        }
    }

    return messages.flatMap((message) => {
        const text = message.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('');

        const steps: ChatToolStep[] = message.content
            .filter((block) => block.type === 'tool_use')
            .map((block) => {
                const result = resultsById.get(block.id);
                return {
                    id: block.id,
                    name: block.name,
                    input: block.input,
                    status: result ? (result.isError ? 'error' : 'ok') : 'ok',
                    ...(result?.isError
                        ? { error: result.content }
                        : { output: result?.content })
                };
            });

        const turnProposals = steps.flatMap(
            (step) => proposalsByCall.get(step.id) ?? []
        );

        // A turn that carried only tool results (no prose, no calls) is
        // plumbing, not something a reader should see as an empty bubble.
        if (!text && steps.length === 0) {
            return [];
        }

        return [
            {
                id: message.id,
                role: message.role,
                text,
                steps,
                ...(turnProposals.length > 0
                    ? { proposals: turnProposals }
                    : {}),
                ...(message.stopReason
                    ? { stopReason: message.stopReason }
                    : {})
            }
        ];
    });
}
