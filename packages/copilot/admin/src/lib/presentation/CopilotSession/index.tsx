import { useEffect, useRef } from 'react';
import { useCopilotChat } from '../../application/useCopilotChat';
import type { CopilotSession as Session } from '../../application/sessions';
import type { RouteContext } from '../../application/readRouteContext';
import { CopilotPanel } from '../CopilotPanel';

/** How much of the first message the dock pill gets as a name. */
const TITLE_LENGTH = 40;

/**
 * One chat, always mounted — window or not.
 *
 * **This component exists so a chat can run while you are not looking at it.**
 * `useCopilotChat` lives here rather than inside `CopilotPanel`, because the
 * panel unmounts when its chat is collapsed to the dock, and a hook inside an
 * unmounted panel takes its `AbortController` cleanup with it: minimizing would
 * silently cancel the run. Lifting it one level is the whole mechanism behind
 * "ask three things at once and watch the dock".
 *
 * It also owns the two things the dock needs to know and the chat is the only
 * one who can tell it: what this thread is **called**, and when something
 * **happened** in it.
 */
export function CopilotSession({
    session,
    workspaceId,
    routeContext,
    slot,
    onMinimize,
    onClose,
    onNewChat,
    onDescribe,
    onActivity
}: {
    session: Session;
    workspaceId: string;
    routeContext: RouteContext;
    /** Which visible window this is; `-1` while collapsed to the dock. */
    slot: number;
    onMinimize(): void;
    onClose(): void;
    onNewChat(): void;
    onDescribe(meta: { conversationId?: string | null; title?: string }): void;
    onActivity(): void;
}) {
    const chat = useCopilotChat(workspaceId, session.minimized);

    // The thread id the first turn created, reported up so the dock can tell
    // two windows apart and refuse to open the same thread twice.
    useEffect(() => {
        if (
            chat.conversationId &&
            chat.conversationId !== session.conversationId
        ) {
            onDescribe({ conversationId: chat.conversationId });
        }
    }, [chat.conversationId, session.conversationId, onDescribe]);

    // Named by what the user asked, which is the only thing available before
    // the server derives a title — and is what they will recognise in a row of
    // pills. Truncated here rather than by CSS so the accessible name is short
    // too; a screen-reader user should not hear a paragraph to pick a tab.
    const firstAsk = chat.messages.find((m) => m.role === 'user')?.text;
    useEffect(() => {
        if (!firstAsk || session.title) return;
        onDescribe({ title: summarize(firstAsk) });
    }, [firstAsk, session.title, onDescribe]);

    // A run ending is the event worth a marker. Edge-triggered off `busy`
    // rather than watching the transcript: a `text-delta` lands dozens of times
    // per answer, and marking on each would fire the moment the first token
    // arrives — before there is anything to come back and read.
    const wasBusy = useRef(chat.busy);
    useEffect(() => {
        if (wasBusy.current && !chat.busy) {
            onActivity();
        }
        wasBusy.current = chat.busy;
    }, [chat.busy, onActivity]);

    return (
        <CopilotPanel
            chat={chat}
            workspaceId={workspaceId}
            routeContext={routeContext}
            title={session.title}
            open={!session.minimized}
            // A collapsed window is mid-exit-transition and about to unmount;
            // keeping it at slot 0 stops it sliding sideways on the way out.
            slot={Math.max(slot, 0)}
            onMinimize={onMinimize}
            onClose={onClose}
            onNewChat={onNewChat}
        />
    );
}

/** The first line of what was asked, short enough to be a tab label. */
function summarize(text: string): string {
    const line = text.trim().split('\n')[0].trim();
    return line.length > TITLE_LENGTH
        ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
        : line;
}
