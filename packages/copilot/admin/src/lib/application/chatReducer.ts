import type { CopilotRunEvent } from '@ortha-cms/copilot-domain';
import type {
    ChatMessage,
    ChatProposal,
    ChatState
} from '../domain/types/chat';

/** Everything that can change the panel's state. */
export type ChatAction =
    /** The user submitted a message; an optimistic turn is appended. */
    | { type: 'submit'; text: string; localId: string }
    /** One frame arrived from the run stream. */
    | { type: 'event'; event: CopilotRunEvent }
    /** The run failed before or outside the stream. */
    | { type: 'failed'; message: string }
    /** Load a persisted transcript, replacing whatever is shown. */
    | { type: 'load'; conversationId: string | null; messages: ChatMessage[] }
    /** Start an empty new chat. */
    | { type: 'reset' }
    /** A decision is in flight for one proposal. */
    | { type: 'deciding'; proposalId: string }
    /** A decision landed — the proposal's new status, or the failure. */
    | {
          type: 'decided';
          proposalId: string;
          status?: ChatProposal['status'];
          entityId?: string;
          error?: string;
      };

/** The empty panel. */
export const initialChatState: ChatState = {
    conversationId: null,
    messages: [],
    busy: false
};

/**
 * Folds run events into the transcript.
 *
 * A **pure reducer** rather than a pile of `setState` calls in the streaming
 * loop, for one reason that matters: a `text-delta` arrives dozens of times per
 * answer, and each one has to append to the *current* last message without
 * reading stale closure state. Keeping it pure also makes the interesting
 * cases — a tool step resolving, a run erroring mid-answer — unit-testable
 * without a server or a socket.
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'reset':
            return initialChatState;

        case 'load':
            return {
                conversationId: action.conversationId,
                messages: action.messages,
                busy: false
            };

        case 'submit':
            return {
                ...state,
                busy: true,
                messages: [
                    ...state.messages,
                    {
                        id: `local-user-${action.localId}`,
                        role: 'user',
                        text: action.text,
                        steps: []
                    },
                    // The assistant turn is created up front and empty, so the
                    // UI has something to show a pending state on before the
                    // first token arrives.
                    {
                        id: `local-assistant-${action.localId}`,
                        role: 'assistant',
                        text: '',
                        steps: [],
                        streaming: true
                    }
                ]
            };

        case 'failed':
            return {
                ...state,
                busy: false,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    streaming: false,
                    error: action.message
                }))
            };

        case 'deciding':
            return mapProposal(state, action.proposalId, (proposal) => ({
                ...proposal,
                deciding: true,
                error: undefined
            }));

        case 'decided':
            return mapProposal(state, action.proposalId, (proposal) => ({
                ...proposal,
                deciding: false,
                ...(action.status ? { status: action.status } : {}),
                ...(action.entityId ? { entityId: action.entityId } : {}),
                error: action.error
            }));

        case 'event':
            return applyEvent(state, action.event);

        default:
            return state;
    }
}

/** One run event, folded in. */
function applyEvent(state: ChatState, event: CopilotRunEvent): ChatState {
    switch (event.type) {
        case 'run-started':
            return { ...state, conversationId: event.conversationId };

        case 'text-delta':
            return {
                ...state,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    text: message.text + event.text
                }))
            };

        case 'tool-call':
            return {
                ...state,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    steps: [
                        ...message.steps,
                        {
                            id: event.id,
                            name: event.name,
                            input: event.input,
                            status: 'running'
                        }
                    ]
                }))
            };

        case 'tool-result':
            return {
                ...state,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    steps: message.steps.map((step) =>
                        step.id === event.id
                            ? {
                                  ...step,
                                  status: event.ok ? 'ok' : 'error',
                                  summary: event.summary,
                                  output: event.output,
                                  error: event.error,
                                  durationMs: event.durationMs
                              }
                            : step
                    )
                }))
            };

        case 'proposal':
            return {
                ...state,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    proposals: [
                        ...(message.proposals ?? []),
                        {
                            id: event.id,
                            toolCallId: event.toolCallId,
                            toolName: event.toolName,
                            kind: event.kind,
                            summary: event.summary,
                            target: event.target as Record<string, unknown>,
                            ...(event.changes
                                ? {
                                      changes:
                                          event.changes as ChatProposal['changes']
                                  }
                                : {}),
                            status: event.status,
                            // Arriving already accepted means nobody clicked —
                            // the workspace opted this tool into auto-apply.
                            ...(event.status === 'accepted'
                                ? { autoApplied: true }
                                : {}),
                            ...(event.entityId
                                ? { entityId: event.entityId }
                                : {})
                        }
                    ]
                }))
            };

        case 'error':
            return {
                ...state,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    error: event.message
                }))
            };

        case 'done':
            return {
                ...state,
                busy: false,
                messages: mapLastAssistant(state.messages, (message) => ({
                    ...message,
                    // Adopt the server's id so a later transcript refetch
                    // reconciles onto the same row instead of duplicating it.
                    id: event.messageId ?? message.id,
                    streaming: false,
                    stopReason: event.stopReason
                }))
            };

        default:
            return state;
    }
}

/**
 * Every proposal in the transcript still waiting on a decision, oldest first.
 *
 * Flattened across turns rather than read off the last one for the same reason
 * `mapProposal` searches the whole transcript: a proposal three answers up is
 * still pending, and a bulk "apply all" that quietly skipped it would be
 * lying about what it did.
 *
 * Proposals with a decision **already in flight** are excluded. The count is
 * what the bulk action offers to do, so counting a card whose own Apply button
 * is mid-request would both overstate the offer and race that request.
 */
export function pendingProposals(messages: ChatMessage[]): ChatProposal[] {
    return messages
        .flatMap((message) => message.proposals ?? [])
        .filter(
            (proposal) => proposal.status === 'pending' && !proposal.deciding
        );
}

/**
 * Applies `change` to one proposal, wherever in the transcript it sits.
 *
 * Searched by id across every turn rather than assumed onto the last one: a
 * proposal stays reviewable after the conversation has moved on, and deciding a
 * card three answers up is the ordinary case, not an edge one.
 */
function mapProposal(
    state: ChatState,
    proposalId: string,
    change: (proposal: ChatProposal) => ChatProposal
): ChatState {
    return {
        ...state,
        messages: state.messages.map((message) =>
            message.proposals?.some((proposal) => proposal.id === proposalId)
                ? {
                      ...message,
                      proposals: message.proposals.map((proposal) =>
                          proposal.id === proposalId
                              ? change(proposal)
                              : proposal
                      )
                  }
                : message
        )
    };
}

/**
 * Applies `change` to the last assistant turn.
 *
 * Every streaming update targets it, and it is always the last element — the
 * reducer appends the placeholder on submit. Searching from the end (rather
 * than assuming `at(-1)`) keeps this correct if a future surface ever appends
 * something after it, and returns the list untouched when there is no
 * assistant turn at all, so a stray frame can't crash the panel.
 */
function mapLastAssistant(
    messages: ChatMessage[],
    change: (message: ChatMessage) => ChatMessage
): ChatMessage[] {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'assistant') {
            const next = [...messages];
            next[index] = change(messages[index]);
            return next;
        }
    }
    return messages;
}
