import type { CopilotModelChoice } from './useCopilotModels';

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
    /**
     * The run is parked on a permission prompt.
     *
     * A **state**, not an event, and that distinction is the bug it was written
     * for: a chat asking you a question stays asking until you answer, so a
     * one-shot `unread` flag misses the ordinary case of parking while visible
     * and *then* being collapsed. It is also not "finished" — the word `unread`
     * would have put on the pill — it is the opposite.
     */
    awaiting: boolean;
    /**
     * Which surface is showing this chat.
     *
     * `dock` is the ordinary case — a floating window, or a pill when
     * `minimized`. `page` means the **Agents view** has it full-screen, so the
     * dock draws neither a window nor a pill for it: it is already on screen,
     * larger than either. Leaving the page hands the chat back to the dock
     * (see `release` in `useCopilotSessions`), which is what lets an answer you
     * started on the page keep streaming while you work somewhere else.
     */
    presented: 'dock' | 'page';
    /**
     * Which backend this chat's **next turn** runs on, or `null` for the host's
     * resolver ("Default").
     *
     * On the session rather than in the component that draws the picker, for
     * the reason everything else here is: components unmount. Held in
     * `useState` it was lost by minimizing a window, and by navigating away from
     * the Agents view — the user picked a model, came back, and silently got the
     * default again.
     *
     * Still **per turn, not per thread**: it is sent with each message and can
     * be changed between them, so a conversation can start cheap and escalate.
     * What this fixes is forgetting the choice, which nobody chose.
     */
    choice: CopilotModelChoice | null;
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
          /** Where it starts life. Defaults to the dock. */
          presented?: 'dock' | 'page';
          /** The model it starts on — seeded from the last one picked. */
          choice?: CopilotModelChoice | null;
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
    | { type: 'activity'; id: string }
    /** The run is, or is no longer, parked on a permission prompt. */
    | { type: 'awaiting'; id: string; value: boolean }
    /** Move a chat between the full-page surface and the dock. */
    | { type: 'present'; id: string; presented: 'dock' | 'page' }
    /** Route this chat's next turn to a different backend. */
    | { type: 'model'; id: string; choice: CopilotModelChoice | null };

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
            const presented = action.presented ?? 'dock';
            const session: CopilotSession = {
                id: action.id,
                conversationId: action.conversationId ?? null,
                title: action.title ?? null,
                minimized: false,
                unread: false,
                awaiting: false,
                presented,
                choice: action.choice ?? null
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
                            ? {
                                  ...s,
                                  minimized: false,
                                  unread: false,
                                  presented
                              }
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

        case 'model':
            return state.map((s) =>
                s.id === action.id ? { ...s, choice: action.choice } : s
            );

        case 'present': {
            const target = state.find((s) => s.id === action.id);
            // The same array back when nothing changed, for the reason the
            // `awaiting` case documents: this is reported from an effect.
            if (!target || target.presented === action.presented) {
                return state as CopilotSession[];
            }
            return capVisible(
                state.map((s) =>
                    s.id === action.id
                        ? {
                              ...s,
                              presented: action.presented,
                              // Handed back to the dock, a chat becomes a
                              // **pill**, not a window that pops open over
                              // whatever page the user just navigated to.
                              // Taken by the page it is neither, and
                              // `minimized: false` keeps the marker rule below
                              // honest — a chat on screen is never "unread".
                              minimized: action.presented === 'dock'
                          }
                        : s
                ),
                action.id
            );
        }

        case 'awaiting': {
            const target = state.find((s) => s.id === action.id);
            // **The same array back when nothing changed**, so `useReducer`
            // bails out of the re-render. The caller reports this from an
            // effect whose callback is a fresh closure each render, so an
            // action that always allocated would re-render, re-run the effect
            // and dispatch again — the render loop this replaced.
            if (!target || target.awaiting === action.value) {
                return state as CopilotSession[];
            }
            return state.map((s) =>
                s.id === action.id ? { ...s, awaiting: action.value } : s
            );
        }

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
    let visible = visibleSessions(next).length;
    for (let i = 0; i < next.length && visible > MAX_OPEN_WINDOWS; i += 1) {
        if (
            next[i].minimized ||
            next[i].presented === 'page' ||
            next[i].id === keep
        )
            continue;
        next[i] = { ...next[i], minimized: true };
        visible -= 1;
    }
    return next;
}

/**
 * The chats **in a dock window**, in open order — index is the window's slot.
 *
 * A page-presented chat is on screen but is not a window, so it takes no slot
 * and never displaces one.
 */
export function visibleSessions(
    sessions: readonly CopilotSession[]
): CopilotSession[] {
    return sessions.filter((s) => !s.minimized && s.presented === 'dock');
}

/** The chats the dock lists as pills — everything it owns. */
export function dockSessions(
    sessions: readonly CopilotSession[]
): CopilotSession[] {
    return sessions.filter((s) => s.presented === 'dock');
}
