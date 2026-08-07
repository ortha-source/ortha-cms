import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { ModelContentBlock } from '@ortha-cms/copilot-domain';
import type { ChatMessage, ChatToolStep } from '../domain/types/chat';
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
            const response = await apiClient.get<ConversationDetail>(
                `/copilot/conversations/${conversationId}`
            );
            return {
                conversation: response.data.conversation,
                messages: toChatMessages(response.data.messages)
            };
        }
    });
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
function toChatMessages(messages: PersistedMessage[]): ChatMessage[] {
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
                ...(message.stopReason
                    ? { stopReason: message.stopReason }
                    : {})
            }
        ];
    });
}
