import { useEffect, useRef } from 'react';
import { useCopilotChat } from '../../application/useCopilotChat';
import type { CopilotSession as Session } from '../../application/sessions';
import type { CopilotModelChoice } from '../../application/useCopilotModels';
import type { RouteContext } from '../../application/readRouteContext';
import { CopilotPanel } from '../CopilotPanel';

/** How much of the first message the dock pill gets as a name. */
const TITLE_LENGTH = 40;

/**
 * One chat, always mounted — window or not.
 *
 * **A view of a chat, not its owner.** The transcript and the run live in the
 * module store (`copilotStore`), so this component unmounting cancels nothing —
 * which is what lets the same chat be a window here and a full page in the
 * Agents view, and survive moving between the two. It used to own the chat, and
 * the mounting rules that came with that are gone.
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
    onActivity,
    onAwaiting,
    onChoiceChange,
    onSkillsChange
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
    onAwaiting(value: boolean): void;
    onChoiceChange(choice: CopilotModelChoice | null): void;
    onSkillsChange(names: readonly string[]): void;
}) {
    const chat = useCopilotChat(session.id, workspaceId, session.minimized);

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

    // Two things are worth a marker, and a chat **parked on a question** is the
    // more urgent of them: it is not merely finished, it is stuck, and it stays
    // stuck until someone looks. Without this a collapsed chat would sit
    // silently for five minutes and then time out having never asked anyone.
    //
    // The other is a run ending, edge-triggered off `busy` rather than watched
    // on the transcript: a `text-delta` lands dozens of times per answer, and
    // marking on each would fire the moment the first token arrives — before
    // there is anything to come back and read.
    const wasBusy = useRef(chat.busy);
    useEffect(() => {
        if (wasBusy.current && !chat.busy) {
            onActivity();
        }
        wasBusy.current = chat.busy;
    }, [chat.busy, onActivity]);

    // Being parked is **reported as state, not as an event**. A chat asking a
    // question stays asking until it is answered, so an edge would miss the
    // ordinary case: parked while you are watching, then collapsed. The
    // reducer ignores a value that has not changed and hands back the same
    // array, which is what keeps this from looping — `onAwaiting` is a fresh
    // closure every render, so this effect re-runs constantly by construction.
    useEffect(() => {
        onAwaiting(chat.awaitingPermission);
    }, [chat.awaitingPermission, onAwaiting]);

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
            // From the session, so collapsing this chat to the dock and
            // reopening it does not quietly put it back on the default model.
            choice={session.choice}
            onChoiceChange={onChoiceChange}
            skills={session.skills}
            onSkillsChange={onSkillsChange}
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
