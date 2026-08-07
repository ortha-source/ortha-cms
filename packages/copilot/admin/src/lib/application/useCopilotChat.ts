import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
    chatReducer,
    initialChatState,
    type ChatAction
} from './chatReducer';
import { conversationsKey } from './useConversations';
import { CopilotRunError, streamRun, type StartRunRequest } from './runStream';
import type { ChatMessage } from '../domain/types/chat';

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
export function useCopilotChat(workspaceId: string): CopilotChat {
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const intl = useIntl();
    const queryClient = useQueryClient();
    const abortRef = useRef<AbortController | null>(null);

    // Cancel an in-flight run when the panel goes away. Without this the
    // generator keeps reading into a dispatch nobody is listening to, and the
    // server keeps paying for an answer nobody will see.
    useEffect(
        () => () => {
            abortRef.current?.abort();
        },
        []
    );

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
                    dispatch({
                        type: 'failed',
                        message: describe(error, () =>
                            intl.formatMessage({
                                id: 'copilot.chat.error.generic',
                                defaultMessage:
                                    'The copilot could not answer. Please try again.'
                            })
                        )
                    });
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

    const dispatchAction = useCallback(
        (action: ChatAction) => dispatch(action),
        []
    );

    return {
        conversationId: state.conversationId,
        messages: state.messages,
        busy: state.busy,
        send,
        stop,
        reset: () => dispatchAction({ type: 'reset' }),
        load: (conversationId, messages) =>
            dispatchAction({ type: 'load', conversationId, messages })
    };
}

/**
 * An error turned into something worth showing.
 *
 * An abort is the user's own Stop button (or an unmount) and gets a neutral
 * line rather than an error; a `CopilotRunError` already carries the server's
 * message, which for a 400 or 403 is the most useful thing we could say.
 */
function describe(error: unknown, fallback: () => string): string {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return 'Stopped.';
    }
    if (error instanceof CopilotRunError) {
        return error.message;
    }
    return fallback();
}
