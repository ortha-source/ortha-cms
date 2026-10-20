import type { CopilotSession } from './sessions';

/** What a launcher says about a set of open chats before anyone opens it. */
export interface ChatsStatus {
    /** How many chats are open. */
    count: number;
    /** How many of them want the user back — finished off screen, or waiting. */
    attention: number;
    /**
     * At least one is parked on a permission prompt. Outranks "finished" in
     * the marker's colour, because a chat blocked on you is the one to open
     * first.
     */
    awaiting: boolean;
}

/**
 * The status of a set of chats, as the dock's "Ask Ortha AI" and the
 * sidebar's Agents switch both show it — the count, and a marker when one of
 * them wants attention.
 *
 * One function so the two cannot drift: a chat counted as "waiting" on one
 * surface and not the other would be worse than either showing nothing. A chat
 * is counted **once** even when it is both unread and awaiting, the same rule
 * as the tab badge (`badgeCount`).
 */
export function chatsStatus(sessions: readonly CopilotSession[]): ChatsStatus {
    return {
        count: sessions.length,
        attention: sessions.filter((s) => s.awaiting || s.unread).length,
        awaiting: sessions.some((s) => s.awaiting)
    };
}

/**
 * The chats the sidebar's Agents switch counts: **every open chat**, wherever
 * it is shown — the dock's, and the one the Agents page is presenting.
 *
 * It counted the dock's alone once, on the grounds that a chat on the page is
 * already on screen. That made the number drop the moment you opened a running
 * chat from the rail and come back when you left — a count of "chats open"
 * that changes with where you are standing reads as chats closing and
 * reopening. The one exclusion is the page's **unsaved new chat** (no thread
 * yet): it is the Agents view's empty state, not a conversation, and counting
 * it would put a `1` on the switch every time the view is opened.
 *
 * The launcher keeps counting the dock alone: it is drawn off the Agents view,
 * where nothing is presented, so the two numbers agree wherever both show.
 */
export function switcherSessions(
    sessions: readonly CopilotSession[]
): CopilotSession[] {
    return sessions.filter(
        (s) => s.presented === 'dock' || s.conversationId !== null
    );
}
