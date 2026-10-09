import type { CopilotStoreState } from './copilotStore';

/**
 * What a thread is doing right now, as the Agents view's rail marks it:
 * `working` while a run streams, `awaiting` while a run is parked on a
 * question only the user can answer.
 */
export type ThreadActivity = 'working' | 'awaiting';

/**
 * Each live thread's activity, by conversation id — only the threads that
 * are doing something; a quiet one is simply absent.
 *
 * Read from the tab's chats (`copilotStore`), because that is where a run
 * lives: the rail's list route knows titles and dates, not that an answer is
 * streaming in a window somewhere. **Awaiting outranks working** — a parked
 * run is still busy, and "it needs you" is the part worth saying. A chat with
 * no thread yet has no row to mark.
 */
export function threadActivity(
    state: CopilotStoreState
): ReadonlyMap<string, ThreadActivity> {
    const activity = new Map<string, ThreadActivity>();
    for (const session of state.sessions) {
        const chat = state.chats[session.id];
        const conversationId = chat?.conversationId ?? session.conversationId;
        if (!conversationId) continue;
        const awaiting =
            session.awaiting ||
            Boolean(
                chat?.messages.some((message) =>
                    message.permissions?.some((request) => !request.answered)
                )
            );
        if (awaiting) activity.set(conversationId, 'awaiting');
        else if (chat?.busy && activity.get(conversationId) !== 'awaiting')
            activity.set(conversationId, 'working');
    }
    return activity;
}
