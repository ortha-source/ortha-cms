import type { CopilotSession } from './sessions';

/**
 * How many chats are **waiting for you** — parked on a permission prompt, so
 * nothing happens until somebody answers it. The one state the dock's "Ask
 * Ortha AI", the sidebar's Agents switch and the panel's history button mark,
 * with an amber dot and the same words in their accessible names.
 *
 * It is the only thing they mark. They used to carry a count of open chats and
 * a second, primary dot for one that had finished off screen, and both were
 * noise on a control you look at all day: the count moved as chats were handed
 * between the Agents page and the dock (closing an idle one on the way), so it
 * blinked out and back on a plain switch to the CMS, and "finished" asks
 * nothing of you. A chat blocked on a question is the one that cannot move
 * without you, so it is the one worth a marker on the way in. "Finished" is
 * still said where it is cheap — the rows of the dock's list and the tab badge.
 *
 * One function so the surfaces cannot drift: a chat marked as waiting on one
 * and not the other would be worse than either showing nothing.
 */
export function chatsAwaiting(sessions: readonly CopilotSession[]): number {
    return sessions.filter((s) => s.awaiting).length;
}
