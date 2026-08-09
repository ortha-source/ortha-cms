/**
 * One chat the user has going — a window, whether or not it is on screen.
 *
 * A session is **client-side and outlives nothing**: it is a window, not a
 * thread. `conversationId` is the server's thread once the first turn has
 * landed, and stays `null` for a chat nobody has typed into yet — which is why
 * the two ids are separate rather than one nullable field doing both jobs.
 */
export interface CopilotSession {
    /** Stable for the life of the window. Not the thread id. */
    id: string;
    /** The persisted thread, once a turn has created one. */
    conversationId: string | null;
    /** What the dock shows. `null` until the first message names it. */
    title: string | null;
    /** Collapsed to the dock rather than shown as a window. */
    minimized: boolean;
    /** Something happened here while it was not on screen. */
    unread: boolean;
}

/**
 * How many chat windows may be on screen at once.
 *
 * Three fits side by side on a 1440px screen without covering the content the
 * chat is *about*, which is the whole reason the panel is non-modal. Opening a
 * fourth does not refuse — it minimizes the oldest visible one to the dock,
 * where it keeps streaming. A hard cap that blocked would be the wrong trade:
 * the user asked for another chat, and the one they stopped looking at is the
 * cheapest thing to give up.
 */
export const MAX_OPEN_WINDOWS = 3;

/** Everything that can change the set of chats. */
export type SessionsAction =
    /** Start a chat. `conversationId`/`title` when reopening a saved thread. */
    | {
          type: 'open';
          id: string;
          conversationId?: string;
          title?: string;
      }
    /** Close a chat for good — its window unmounts and its run is cancelled. */
    | { type: 'close'; id: string }
    /** Show a chat and clear its marker. */
    | { type: 'focus'; id: string }
    /** Collapse a chat to the dock. It keeps running. */
    | { type: 'minimize'; id: string }
    /** Collapse if shown, show if collapsed — what clicking its pill does. */
    | { type: 'toggle'; id: string }
    /** The thread id or title the chat learned from the server. */
    | {
          type: 'meta';
          id: string;
          conversationId?: string | null;
          title?: string;
      }
    /** A run finished here. Marks it only if nobody is looking. */
    | { type: 'activity'; id: string };

/**
 * Folds an action into the set of open chats.
 *
 * Pure, so the two rules with any subtlety in them are unit tests rather than
 * promises: **the window cap minimizes rather than refuses**, and **a marker
 * is only ever set on a chat that is not on screen** — a badge on the window
 * you are reading is noise, and worse, it trains people to ignore the badge.
 */
export function sessionsReducer(
    state: readonly CopilotSession[],
    action: SessionsAction
): CopilotSession[] {
    switch (action.type) {
        case 'open': {
            const session: CopilotSession = {
                id: action.id,
                conversationId: action.conversationId ?? null,
                title: action.title ?? null,
                minimized: false,
                unread: false
            };
            // Reopening a thread that is already open focuses it instead of
            // showing the same conversation in two windows, which would give it
            // two transcripts that immediately disagree.
            const existing = action.conversationId
                ? state.find((s) => s.conversationId === action.conversationId)
                : undefined;
            if (existing) {
                return capVisible(
                    state.map((s) =>
                        s.id === existing.id
                            ? { ...s, minimized: false, unread: false }
                            : s
                    ),
                    existing.id
                );
            }
            return capVisible([...state, session], session.id);
        }

        case 'close':
            return state.filter((s) => s.id !== action.id);

        case 'focus':
            return capVisible(
                state.map((s) =>
                    s.id === action.id
                        ? { ...s, minimized: false, unread: false }
                        : s
                ),
                action.id
            );

        case 'minimize':
            return state.map((s) =>
                s.id === action.id ? { ...s, minimized: true } : s
            );

        case 'toggle': {
            const target = state.find((s) => s.id === action.id);
            if (!target) return [...state];
            return target.minimized
                ? sessionsReducer(state, { type: 'focus', id: action.id })
                : sessionsReducer(state, { type: 'minimize', id: action.id });
        }

        case 'meta':
            return state.map((s) =>
                s.id === action.id
                    ? {
                          ...s,
                          ...(action.conversationId !== undefined
                              ? { conversationId: action.conversationId }
                              : {}),
                          ...(action.title !== undefined
                              ? { title: action.title }
                              : {})
                      }
                    : s
            );

        case 'activity':
            return state.map((s) =>
                // Only when it is off screen. A run that finishes in the window
                // the user is watching has already told them it finished.
                s.id === action.id && s.minimized ? { ...s, unread: true } : s
            );

        default:
            return [...state];
    }
}

/**
 * Keeps at most {@link MAX_OPEN_WINDOWS} on screen, never minimizing `keep`.
 *
 * The victim is the **oldest** visible window — first in the list, which is
 * open order. Least-recently-focused would be more clever and needs a timestamp
 * per session; open order is predictable, which matters more for something that
 * moves a window out from under the user.
 */
function capVisible(
    sessions: readonly CopilotSession[],
    keep: string
): CopilotSession[] {
    const next = [...sessions];
    let visible = next.filter((s) => !s.minimized).length;
    for (let i = 0; i < next.length && visible > MAX_OPEN_WINDOWS; i += 1) {
        if (next[i].minimized || next[i].id === keep) continue;
        next[i] = { ...next[i], minimized: true };
        visible -= 1;
    }
    return next;
}

/** The chats on screen, in open order — index is the window's slot. */
export function visibleSessions(
    sessions: readonly CopilotSession[]
): CopilotSession[] {
    return sessions.filter((s) => !s.minimized);
}
