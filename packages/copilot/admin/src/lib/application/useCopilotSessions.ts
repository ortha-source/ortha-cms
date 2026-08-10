import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
    chatStateOf,
    copilotStoreState,
    dispatchSessions,
    nextSessionId,
    subscribeToCopilotStore
} from './copilotStore';
import { dockSessions, visibleSessions, type CopilotSession } from './sessions';

/** What the dock, the windows and the Agents page all read. */
export interface CopilotSessions {
    /** Every open chat, in open order — including the page's. */
    all: CopilotSession[];
    /** The ones the **dock** owns: pills, and windows among them. */
    dock: CopilotSession[];
    /** The ones in a dock window — index is the window's slot. */
    visible: CopilotSession[];
    /** Starts an empty chat and shows it. Returns its id. */
    start(presented?: 'dock' | 'page'): string;
    /** Shows a saved thread, focusing the chat already on it if there is one. */
    openThread(
        conversationId: string,
        title: string | null,
        presented?: 'dock' | 'page'
    ): string;
    /** Closes a chat for good; its run is cancelled and its transcript dropped. */
    close(id: string): void;
    /** Shows a chat and clears its marker. */
    focus(id: string): void;
    /** Collapses a chat to the dock. It keeps running. */
    minimize(id: string): void;
    /** What clicking a dock pill does. */
    toggle(id: string): void;
    /** Moves a chat between the full-page surface and the dock. */
    present(id: string, presented: 'dock' | 'page'): void;
    /**
     * Hands a chat the Agents page was showing back to the dock — **or throws
     * it away**. See the implementation for the rule; it is the difference
     * between a useful dock and a dock full of threads you glanced at.
     */
    release(id: string): void;
    /** Records the thread id or title a chat learned from the server. */
    describe(
        id: string,
        meta: { conversationId?: string | null; title?: string }
    ): void;
    /** A run finished. Marks the chat only if it is off screen. */
    noteActivity(id: string): void;
    /** Records whether the chat is parked on a permission prompt. */
    setAwaiting(id: string, value: boolean): void;
}

/**
 * The set of chats the tab has going.
 *
 * A thin, stable-callback view over the **module store** — so the dock, a
 * window and the Agents page all see one set, and none of them owns it. That is
 * what lets a chat started full-page carry on as a dock pill when you navigate
 * away, instead of being cancelled by its own component unmounting.
 */
export function useCopilotSessions(): CopilotSessions {
    const all = useSyncExternalStore(
        subscribeToCopilotStore,
        () => copilotStoreState().sessions
    ) as CopilotSession[];

    const start = useCallback((presented: 'dock' | 'page' = 'dock') => {
        const id = nextSessionId();
        dispatchSessions({ type: 'open', id, presented });
        return id;
    }, []);

    const openThread = useCallback(
        (
            conversationId: string,
            title: string | null,
            presented: 'dock' | 'page' = 'dock'
        ) => {
            // The reducer focuses a chat already on this thread rather than
            // opening a second one, so the id it ends up under may not be the
            // one minted here — resolve it from the store afterwards.
            const id = nextSessionId();
            dispatchSessions({
                type: 'open',
                id,
                conversationId,
                presented,
                ...(title ? { title } : {})
            });
            const landed = copilotStoreState().sessions.find(
                (session) => session.conversationId === conversationId
            );
            return landed?.id ?? id;
        },
        []
    );

    const close = useCallback(
        (id: string) => dispatchSessions({ type: 'close', id }),
        []
    );
    const focus = useCallback(
        (id: string) => dispatchSessions({ type: 'focus', id }),
        []
    );
    const minimize = useCallback(
        (id: string) => dispatchSessions({ type: 'minimize', id }),
        []
    );
    const toggle = useCallback(
        (id: string) => dispatchSessions({ type: 'toggle', id }),
        []
    );
    const present = useCallback(
        (id: string, presented: 'dock' | 'page') =>
            dispatchSessions({ type: 'present', id, presented }),
        []
    );

    const release = useCallback((id: string) => {
        const session = copilotStoreState().sessions.find((s) => s.id === id);
        if (!session) {
            return;
        }
        const chat = chatStateOf(id);
        // **Only a chat with something happening in it earns a pill.** Keeping
        // every thread you opened would fill the dock with conversations you
        // merely read — and they are persisted server-side and one click away in
        // the rail, so nothing is lost by dropping them. A run in flight, or one
        // parked on a permission prompt, is the opposite: it has an answer
        // coming, or it is stuck waiting for you.
        const worthKeeping = chat.busy || session.awaiting;
        dispatchSessions(
            worthKeeping
                ? { type: 'present', id, presented: 'dock' }
                : { type: 'close', id }
        );
    }, []);

    const describe = useCallback(
        (
            id: string,
            meta: { conversationId?: string | null; title?: string }
        ) => dispatchSessions({ type: 'meta', id, ...meta }),
        []
    );
    const noteActivity = useCallback(
        (id: string) => dispatchSessions({ type: 'activity', id }),
        []
    );
    const setAwaiting = useCallback(
        (id: string, value: boolean) =>
            dispatchSessions({ type: 'awaiting', id, value }),
        []
    );

    const dock = useMemo(() => dockSessions(all), [all]);
    const visible = useMemo(() => visibleSessions(all), [all]);

    return {
        all,
        dock,
        visible,
        start,
        openThread,
        close,
        focus,
        minimize,
        toggle,
        present,
        release,
        describe,
        noteActivity,
        setAwaiting
    };
}
