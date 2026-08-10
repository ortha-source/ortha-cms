import { useCallback, useRef, useSyncExternalStore } from 'react';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@ortha-cms/design-system';
import {
    abortRun,
    beginRun,
    chatStateOf,
    dispatchChat,
    endRun,
    runController,
    subscribeToCopilotStore
} from './copilotStore';
import type { ChatAction } from './chatReducer';
import { conversationsScopeKey } from './useConversations';
import { CopilotRunError, streamRun, type StartRunRequest } from './runStream';
import { useDecideToolPermission } from './useDecideToolPermission';
import type { ToolPermissionDecision } from '@ortha-cms/copilot-domain';
import type { ChatMessage } from '../domain/types/chat';

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
    }
});

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
    /** Answers a tool call the run is parked on. */
    answer(
        runId: string,
        callId: string,
        decision: ToolPermissionDecision
    ): void;
    /** True while the run is waiting on the user rather than on the model. */
    awaitingPermission: boolean;
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
    /** Which chat in the store this is a view of. */
    sessionId: string,
    workspaceId: string,
    /**
     * True when the chat is not on screen — collapsed to the dock, or on a page
     * the user has navigated away from. A run keeps streaming either way, so
     * this is the one state where a failure can happen with nobody able to see
     * the alert, and therefore the only state that warrants a toast.
     */
    hidden = false
): CopilotChat {
    const state = useSyncExternalStore(subscribeToCopilotStore, () =>
        chatStateOf(sessionId)
    );
    const intl = useIntl();
    const queryClient = useQueryClient();
    const decidePermission = useDecideToolPermission();
    const dispatch = useCallback(
        (action: ChatAction) => dispatchChat(sessionId, action),
        [sessionId]
    );
    // Read through a ref, never the captured value: `send`'s async closure is
    // created when the message is sent, but the failure it handles can land
    // seconds later, by which time the user may well have minimized the panel —
    // which is exactly the case the toast exists for. Capturing `hidden` would
    // decide on the state the panel was in when they hit Enter.
    const hiddenRef = useRef(hidden);
    hiddenRef.current = hidden;

    // **No abort-on-unmount.** It used to live here, and it is what made
    // navigating away from the Agents view a disguised cancel: a hook inside an
    // unmounting component took the run's cleanup with it. A run now ends only
    // when someone ends it — `stop()`, or closing the chat — and the store keeps
    // it alive in between. See `copilotStore`.

    const send = useCallback(
        (
            text: string,
            context?: StartRunRequest['context'],
            options?: CopilotChatOptions
        ) => {
            const trimmed = text.trim();
            if (!trimmed || runController(sessionId)) {
                return;
            }

            const controller = new AbortController();
            beginRun(sessionId, controller);
            const localId = String(Date.now());
            dispatch({ type: 'submit', text: trimmed, localId });

            void (async () => {
                try {
                    // Read at send time, not from the render that created this
                    // closure: the thread id can be minted by a run that is
                    // still in flight when the next turn is queued.
                    const conversationId =
                        chatStateOf(sessionId).conversationId;
                    const events = streamRun(
                        {
                            message: trimmed,
                            ...(conversationId ? { conversationId } : {}),
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
                        // Abort is not instantaneous: frames already read out of
                        // the buffer would otherwise keep dispatching after the
                        // caller moved on — and on the Agents page "moved on"
                        // means a *different thread's* transcript is now in the
                        // reducer, so a cancelled answer would append itself to
                        // someone else's conversation.
                        if (runController(sessionId) !== controller) {
                            break;
                        }
                        dispatch({ type: 'event', event });
                    }
                } catch (error) {
                    // Same reason as above: a run nobody is listening to any
                    // more must not write its failure into the transcript that
                    // replaced it.
                    if (runController(sessionId) !== controller) {
                        return;
                    }
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
                    endRun(sessionId, controller);
                    // The thread list's titles and ordering both change with a
                    // turn, and a brand-new thread doesn't exist in it at all
                    // until now.
                    void queryClient.invalidateQueries({
                        queryKey: conversationsScopeKey(workspaceId)
                    });
                }
            })();
        },
        [dispatch, intl, queryClient, sessionId, workspaceId]
    );

    const stop = useCallback(() => abortRun(sessionId), [sessionId]);

    const answer = useCallback(
        (runId: string, callId: string, decision: ToolPermissionDecision) => {
            dispatch({ type: 'answering', callId });
            decidePermission.mutate(
                { runId, callId, decision, workspaceId },
                {
                    onSuccess: () => dispatch({ type: 'answered', callId }),
                    // The prompt keeps its buttons and says so. A 404 means the
                    // run had already moved on — telling the user their click
                    // did nothing is the only honest option.
                    onError: () =>
                        dispatch({
                            type: 'answered',
                            callId,
                            error: 'not-delivered'
                        })
                }
            );
        },
        [decidePermission, workspaceId]
    );

    return {
        conversationId: state.conversationId,
        messages: state.messages,
        busy: state.busy,
        send,
        stop,
        answer,
        // Drives the dock's marker: a chat parked on a question is exactly the
        // one worth coming back to, and `busy` alone cannot say so — it is true
        // for "thinking" too.
        awaitingPermission: state.messages.some((message) =>
            message.permissions?.some((request) => !request.answered)
        ),
        reset: () => dispatch({ type: 'reset' }),
        load: (conversationId, messages) =>
            dispatch({ type: 'load', conversationId, messages })
    };
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
