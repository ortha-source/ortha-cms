import { useCallback, useMemo, useReducer, useRef } from 'react';
import {
    sessionsReducer,
    visibleSessions,
    type CopilotSession
} from './sessions';

/** What the dock and the windows both read. */
export interface CopilotSessions {
    /** Every open chat, in open order. */
    all: CopilotSession[];
    /** The ones on screen — index is the window's slot. */
    visible: CopilotSession[];
    /** Starts an empty chat and shows it. Returns its id. */
    start(): string;
    /** Shows a saved thread, focusing the window already on it if there is one. */
    openThread(conversationId: string, title: string | null): void;
    /** Closes a chat for good; its window unmounts and its run is cancelled. */
    close(id: string): void;
    /** Shows a chat and clears its marker. */
    focus(id: string): void;
    /** Collapses a chat to the dock. It keeps running. */
    minimize(id: string): void;
    /** What clicking a dock pill does. */
    toggle(id: string): void;
    /** Records the thread id or title a chat learned from the server. */
    describe(
        id: string,
        meta: { conversationId?: string | null; title?: string }
    ): void;
    /** A run finished. Marks the chat only if it is off screen. */
    noteActivity(id: string): void;
}

/**
 * The set of chats the user has going.
 *
 * The reducer is pure and lives in `sessions.ts`; this adds the two things it
 * cannot have — id generation and stable callbacks. Ids are a plain counter
 * rather than `crypto.randomUUID()`: they never leave the browser, they are not
 * thread ids, and a counter makes a window's identity readable in the React
 * devtools while debugging a stuck run.
 */
export function useCopilotSessions(): CopilotSessions {
    const [all, dispatch] = useReducer(sessionsReducer, [] as CopilotSession[]);
    const nextId = useRef(0);

    const start = useCallback(() => {
        const id = `chat-${(nextId.current += 1)}`;
        dispatch({ type: 'open', id });
        return id;
    }, []);

    const openThread = useCallback(
        (conversationId: string, title: string | null) => {
            dispatch({
                type: 'open',
                id: `chat-${(nextId.current += 1)}`,
                conversationId,
                ...(title ? { title } : {})
            });
        },
        []
    );

    const close = useCallback(
        (id: string) => dispatch({ type: 'close', id }),
        []
    );
    const focus = useCallback(
        (id: string) => dispatch({ type: 'focus', id }),
        []
    );
    const minimize = useCallback(
        (id: string) => dispatch({ type: 'minimize', id }),
        []
    );
    const toggle = useCallback(
        (id: string) => dispatch({ type: 'toggle', id }),
        []
    );
    const describe = useCallback(
        (
            id: string,
            meta: { conversationId?: string | null; title?: string }
        ) => dispatch({ type: 'meta', id, ...meta }),
        []
    );
    const noteActivity = useCallback(
        (id: string) => dispatch({ type: 'activity', id }),
        []
    );

    const visible = useMemo(() => visibleSessions(all), [all]);

    return {
        all,
        visible,
        start,
        openThread,
        close,
        focus,
        minimize,
        toggle,
        describe,
        noteActivity
    };
}
