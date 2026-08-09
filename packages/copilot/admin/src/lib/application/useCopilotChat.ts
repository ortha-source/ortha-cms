import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState
} from 'react';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@ortha-cms/design-system';
import {
    chatReducer,
    initialChatState,
    pendingProposals,
    type ChatAction
} from './chatReducer';
import { conversationsKey } from './useConversations';
import { CopilotRunError, streamRun, type StartRunRequest } from './runStream';
import { useDecideProposal } from './useDecideProposal';
import type { ChatMessage, ChatProposal } from '../domain/types/chat';

const messages = defineMessages({
    generic: {
        id: 'copilot.chat.error.generic',
        defaultMessage: 'Ortha AI could not answer. Please try again.'
    },
    rejectedTitle: {
        id: 'copilot.chat.error.rejectedTitle',
        defaultMessage: 'Ortha AI could not start'
    },
    signedOut: {
        id: 'copilot.chat.error.signedOut',
        defaultMessage: 'Your session has expired. Sign in again to continue.'
    },
    offline: {
        id: 'copilot.chat.error.offline',
        defaultMessage: 'Could not reach the server. Check your connection.'
    },
    decideFailed: {
        id: 'copilot.chat.error.decideFailed',
        defaultMessage: 'That change could not be decided. Please try again.'
    }
});

/** How far a bulk decision has got. */
export interface BulkDecision {
    /** Which decision is being applied to the whole queue. */
    decision: 'accept' | 'reject';
    /** How many have been answered so far. */
    done: number;
    /** How many were pending when the user clicked. */
    total: number;
}

/** How one turn should be routed, when the user has picked. */
export interface CopilotChatOptions {
    /** The provider to run on, or `null` for the host's resolver. */
    provider?: string | null;
    /** The model to run on, or `null` for the provider's default. */
    model?: string | null;
}

/** What the panel needs from this hook. */
export interface CopilotChat {
    /** The thread being viewed, or `null` for an unsaved new chat. */
    conversationId: string | null;
    /** The transcript, oldest first. */
    messages: ChatMessage[];
    /** True from submit until the run ends. */
    busy: boolean;
    /** Sends a message and streams the answer. */
    send(
        text: string,
        context?: StartRunRequest['context'],
        options?: CopilotChatOptions
    ): void;
    /** Cancels the run in flight. */
    stop(): void;
    /** Starts an empty new chat. */
    reset(): void;
    /** Shows a persisted thread. */
    load(conversationId: string, messages: ChatMessage[]): void;
    /** Accepts or rejects one proposed change. */
    decide(proposalId: string, decision: 'accept' | 'reject'): void;
    /** Every change in the transcript still waiting on a decision. */
    pending: ChatProposal[];
    /** Accepts or rejects **all** of them, one after another. */
    decideAll(decision: 'accept' | 'reject'): void;
    /** The bulk decision in flight, or `null`. */
    bulk: BulkDecision | null;
}

/**
 * Drives one chat panel: owns the transcript, runs the stream, and cancels it.
 *
 * The run loop lives in an effect-free callback holding an `AbortController` in
 * a ref, so cancelling is the same code path whether the user pressed Stop or
 * the panel unmounted mid-answer. The server treats a client disconnect as an
 * abort and ends the run with `stopReason: 'aborted'`, so nothing is left
 * running server-side either way.
 */
export function useCopilotChat(
    workspaceId: string,
    /**
     * True when the panel is collapsed to its title bar. A run keeps streaming
     * while minimized, so this is the one state where a failure can happen with
     * nobody able to see the alert — and therefore the only state that warrants
     * a toast.
     */
    hidden = false
): CopilotChat {
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const intl = useIntl();
    const decideProposal = useDecideProposal();
    const queryClient = useQueryClient();
    const abortRef = useRef<AbortController | null>(null);
    // Read through a ref, never the captured value: `send`'s async closure is
    // created when the message is sent, but the failure it handles can land
    // seconds later, by which time the user may well have minimized the panel —
    // which is exactly the case the toast exists for. Capturing `hidden` would
    // decide on the state the panel was in when they hit Enter.
    const hiddenRef = useRef(hidden);
    hiddenRef.current = hidden;
    // Same reasoning as `hiddenRef`, for the bulk queue: the click reads the
    // transcript as it is *at that moment*, and the loop that follows must not
    // see the render it started on.
    const stateRef = useRef(state);
    stateRef.current = state;
    const [bulk, setBulk] = useState<BulkDecision | null>(null);
    // Guards the loop rather than the button: `bulk` lands a render later, so a
    // double-click would start two queues over the same proposals before the
    // first `setBulk` had disabled anything.
    const bulkRef = useRef(false);
    // Cleared on unmount so a queue stops between requests instead of
    // dispatching into a reducer that is no longer mounted.
    const aliveRef = useRef(true);

    // Cancel an in-flight run when the panel goes away. Without this the
    // generator keeps reading into a dispatch nobody is listening to, and the
    // server keeps paying for an answer nobody will see.
    useEffect(() => {
        // Re-armed in the body, not just initialised: StrictMode mounts, tears
        // down and remounts, so a flag only ever set to `false` in the cleanup
        // would leave the remounted panel permanently unable to dispatch.
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            abortRef.current?.abort();
        };
    }, []);

    const send = useCallback(
        (
            text: string,
            context?: StartRunRequest['context'],
            options?: CopilotChatOptions
        ) => {
            const trimmed = text.trim();
            if (!trimmed || abortRef.current) {
                return;
            }

            const controller = new AbortController();
            abortRef.current = controller;
            const localId = String(Date.now());
            dispatch({ type: 'submit', text: trimmed, localId });

            void (async () => {
                try {
                    const events = streamRun(
                        {
                            message: trimmed,
                            ...(state.conversationId
                                ? { conversationId: state.conversationId }
                                : {}),
                            uiLocale: intl.locale,
                            // Omitted rather than sent as null: the strict
                            // server pipe accepts an absent optional field but
                            // rejects a null one.
                            ...(options?.provider
                                ? { provider: options.provider }
                                : {}),
                            ...(options?.model ? { model: options.model } : {}),
                            ...(context ? { context } : {})
                        },
                        { workspaceId, signal: controller.signal }
                    );
                    for await (const event of events) {
                        dispatch({ type: 'event', event });
                    }
                } catch (error) {
                    const failure = describe(error, intl);
                    // The alert in the transcript is always the record — it
                    // stays with the turn it belongs to and survives scrolling.
                    dispatch({ type: 'failed', message: failure.message });

                    // The toast is only for reaching someone who *cannot see*
                    // that alert, which means the panel is minimized (a run
                    // keeps streaming while it is). Toasting with the panel open
                    // would be worse than useless: the host mounts `Toaster`
                    // bottom-right, exactly where the panel sits, so it would
                    // cover the composer to announce something already on
                    // screen a few pixels above.
                    if (hiddenRef.current && failure.systemic) {
                        toast.error(
                            intl.formatMessage(messages.rejectedTitle),
                            {
                                description: failure.message
                            }
                        );
                    }
                } finally {
                    abortRef.current = null;
                    // The thread list's titles and ordering both change with a
                    // turn, and a brand-new thread doesn't exist in it at all
                    // until now.
                    void queryClient.invalidateQueries({
                        queryKey: conversationsKey(workspaceId)
                    });
                }
            })();
        },
        [intl, queryClient, state.conversationId, workspaceId]
    );

    const stop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    /**
     * One decision, awaited.
     *
     * Promise-shaped rather than `mutate` + callbacks so the bulk action can
     * queue decisions behind one another. The two entry points below are the
     * same request either way — there is no batch endpoint and deliberately so:
     * every accept keeps its own permission re-check, its own `pending`
     * predicate, and its own audit row, which is the whole of ADR-0005 §5. A
     * bulk route would have to reproduce all three and answer with a partial
     * success nobody could render per card.
     */
    const decideOne = useCallback(
        async (proposalId: string, decision: 'accept' | 'reject') => {
            dispatch({ type: 'deciding', proposalId });
            try {
                const proposal = await decideProposal.mutateAsync({
                    proposalId,
                    decision,
                    workspaceId
                });
                if (!aliveRef.current) return;
                dispatch({
                    type: 'decided',
                    proposalId,
                    status: proposal.status,
                    ...(proposal.result?.entityId
                        ? { entityId: proposal.result.entityId }
                        : {})
                });
            } catch (error) {
                if (!aliveRef.current) return;
                // The card keeps its buttons and shows why. The four statuses
                // the server can return mean different things to the person
                // clicking — someone got there first, you may not, it could not
                // be applied and is still pending — and the server's own
                // message says which. Collapsing them into "failed" would lose
                // exactly what tells them whether to retry, refresh, or ask a
                // colleague.
                dispatch({
                    type: 'decided',
                    proposalId,
                    error: decisionMessage(error, intl)
                });
            }
        },
        [decideProposal, intl, workspaceId]
    );

    const decide = useCallback(
        (proposalId: string, decision: 'accept' | 'reject') => {
            void decideOne(proposalId, decision);
        },
        [decideOne]
    );

    /**
     * Decides every pending proposal in the transcript.
     *
     * **Sequential, not parallel.** Two proposals in one answer routinely touch
     * the same entry, and firing them together would race the appliers writing
     * it; sequencing also keeps the transcript's cards resolving in the order
     * they were proposed, so the progress the user reads matches what happened.
     *
     * **A failure does not stop the queue.** Each card records its own error
     * and stays decidable, so one entry that fails validation costs the user
     * that one change rather than every change after it.
     *
     * The queue is **snapshotted at the click**: a proposal that arrives from a
     * still-streaming run afterwards was not part of what the user agreed to.
     */
    const decideAll = useCallback(
        (decision: 'accept' | 'reject') => {
            if (bulkRef.current) return;
            const queue = pendingProposals(stateRef.current.messages);
            if (queue.length === 0) return;

            bulkRef.current = true;
            setBulk({ decision, done: 0, total: queue.length });
            void (async () => {
                for (const [index, proposal] of queue.entries()) {
                    if (!aliveRef.current) break;
                    await decideOne(proposal.id, decision);
                    if (!aliveRef.current) break;
                    setBulk({
                        decision,
                        done: index + 1,
                        total: queue.length
                    });
                }
                bulkRef.current = false;
                if (aliveRef.current) setBulk(null);
            })();
        },
        [decideOne]
    );

    const dispatchAction = useCallback(
        (action: ChatAction) => dispatch(action),
        []
    );

    const pending = useMemo(
        () => pendingProposals(state.messages),
        [state.messages]
    );

    return {
        conversationId: state.conversationId,
        messages: state.messages,
        busy: state.busy,
        send,
        stop,
        decide,
        pending,
        decideAll,
        bulk,
        reset: () => dispatchAction({ type: 'reset' }),
        load: (conversationId, messages) =>
            dispatchAction({ type: 'load', conversationId, messages })
    };
}

/**
 * A failed accept/reject, in words the person clicking can act on.
 *
 * The server's own message is preferred wherever it has one: for a 409 it says
 * the proposal was already decided, for a 403 that they may not apply it, for a
 * 422 why the change could not be carried out. Those are more useful than
 * anything restated here, and they are the difference between "refresh" and
 * "try again".
 */
function decisionMessage(error: unknown, intl: IntlShape): string {
    const response = (
        error as {
            response?: { data?: { message?: string | string[] } };
        }
    )?.response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message) {
        return message;
    }
    if (Array.isArray(message) && message.length > 0) {
        return message.join(' ');
    }
    return intl.formatMessage(messages.decideFailed);
}

/** What to show, and whether it is worth interrupting the user for. */
interface Failure {
    /** The line shown in the transcript, and in the toast's description. */
    message: string;
    /**
     * Whether this is a **system** condition rather than something about this
     * conversation — the session died, the server is unreachable, the request
     * was rejected before a run started. Only these toast: a run that failed
     * mid-answer belongs to its turn, and a toast for it would cover the
     * composer to tell the user something already on screen.
     */
    systemic: boolean;
}

/**
 * Classifies a thrown error into what the user should see.
 *
 * An abort is the user's own Stop button (or an unmount), so it is not a
 * failure at all. A `CopilotRunError` means the server answered with a status
 * instead of a stream — its message is the server's own, which for a 400 or 403
 * is the most useful thing we could say. Anything else reaching here is a
 * `fetch` that never got an answer, i.e. the network.
 */
function describe(error: unknown, intl: IntlShape): Failure {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return { message: 'Stopped.', systemic: false };
    }
    if (error instanceof CopilotRunError) {
        // 401 is the one worth rewording: the server's "Unauthorized" is
        // accurate and useless, and being signed out is not a chat problem.
        if (error.status === 401) {
            return {
                message: intl.formatMessage(messages.signedOut),
                systemic: true
            };
        }
        return { message: error.message, systemic: true };
    }
    if (error instanceof TypeError) {
        // `fetch` rejects with a TypeError when it cannot reach the host at
        // all — DNS, offline, CORS, connection refused.
        return {
            message: intl.formatMessage(messages.offline),
            systemic: true
        };
    }
    return { message: intl.formatMessage(messages.generic), systemic: false };
}
