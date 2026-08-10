import { chatReducer, initialChatState, type ChatAction } from './chatReducer';
import {
    sessionsReducer,
    type CopilotSession,
    type SessionsAction
} from './sessions';
import type { ChatState } from '../domain/types/chat';

/** Every chat the tab has going, and the transcript of each. */
export interface CopilotStoreState {
    /** The set of chats, in open order. */
    readonly sessions: readonly CopilotSession[];
    /** Each chat's transcript, keyed by session id. */
    readonly chats: Readonly<Record<string, ChatState>>;
}

/**
 * The chats this tab has going — **outside React, on purpose**.
 *
 * A chat used to live in the component that showed it, and that made *being
 * rendered* the condition for *still running*: navigating away from the Agents
 * view unmounted its `useCopilotChat` and took the run's `AbortController`
 * cleanup with it, so leaving the page was a disguised cancel. The docked panel
 * worked around the same problem by keeping every chat mounted in the sidebar —
 * which is why the dock can run three answers at once and the page could not.
 *
 * Holding the state here makes "who is currently rendering this" irrelevant.
 * Components become views: the page and the dock can show the same chat, either
 * can unmount, and the run carries on. Cancelling is now something you *do*
 * (close the chat), never something that happens to you because a route changed.
 *
 * **Its lifetime is the tab.** A module singleton dies on reload, which is
 * exactly the ceiling here: the server treats a client disconnect as an abort
 * (`stopReason: 'aborted'`), so a run cannot outlive the page that started it
 * without the server keeping it alive and replaying frames on reconnect. That is
 * a different, much larger feature; this is the honest version of "keeps running
 * while you work".
 *
 * The reducers are the same pure ones as before (`sessionsReducer`,
 * `chatReducer`) and are still unit-tested on their own — this module owns
 * subscription and identity, not rules.
 */
let state: CopilotStoreState = { sessions: [], chats: {} };

const listeners = new Set<() => void>();

/**
 * The `AbortController` of each chat's in-flight run.
 *
 * Deliberately *not* in `state`: a controller is not something anything renders,
 * and putting it there would publish a new state object on every run start and
 * stop for no visual reason.
 */
const controllers = new Map<string, AbortController>();

/** Session ids are a plain counter — see {@link nextSessionId}. */
let counter = 0;

/** Publishes `next` and wakes subscribers, unless nothing actually changed. */
function commit(next: CopilotStoreState): void {
    if (next === state) {
        return;
    }
    state = next;
    // A copy, so a listener that unsubscribes during the notification (a
    // component unmounting because of this very change) cannot corrupt the walk.
    for (const listener of [...listeners]) {
        listener();
    }
}

/** Subscribes to every change. Returns the unsubscribe. */
export function subscribeToCopilotStore(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * The current state.
 *
 * The returned object — and `sessions` and each `chats[id]` inside it — is
 * **referentially stable while unchanged**, which is what `useSyncExternalStore`
 * needs to avoid an infinite render loop, and what keeps a chat's transcript
 * from re-rendering the dock on every streamed token.
 */
export function copilotStoreState(): CopilotStoreState {
    return state;
}

/** One chat's transcript, or the empty one if its session is gone. */
export function chatStateOf(sessionId: string): ChatState {
    return state.chats[sessionId] ?? initialChatState;
}

/**
 * A fresh session id.
 *
 * A counter rather than `crypto.randomUUID()`: these never leave the browser,
 * they are not thread ids, and a counter makes a window's identity readable in
 * the React devtools while debugging a stuck run.
 */
export function nextSessionId(): string {
    counter += 1;
    return `chat-${counter}`;
}

/**
 * Applies an action to the set of chats, keeping each chat's transcript in step:
 * opening a chat seeds an empty one, closing a chat aborts its run and drops it.
 */
export function dispatchSessions(action: SessionsAction): void {
    const sessions = sessionsReducer(state.sessions, action);
    if (sessions === state.sessions) {
        return;
    }

    let chats = state.chats;

    // `open` on a thread that is already open focuses the existing session
    // instead of adding one, so seed only when the id really is in the list.
    if (
        action.type === 'open' &&
        !(action.id in chats) &&
        sessions.some((session) => session.id === action.id)
    ) {
        chats = { ...chats, [action.id]: initialChatState };
    }

    if (action.type === 'close') {
        // Closing is the one thing that cancels a run. Unmounting no longer
        // does, which is the entire point of this module.
        abortRun(action.id);
        const { [action.id]: closed, ...rest } = chats;
        void closed;
        chats = rest;
    }

    commit({ sessions, chats });
}

/** Folds one run event (or local action) into a chat's transcript. */
export function dispatchChat(sessionId: string, action: ChatAction): void {
    const current = state.chats[sessionId];
    // A frame that arrives after its chat was closed. Dropping it is correct —
    // there is nothing left to show it in — and the run is already aborting.
    if (!current) {
        return;
    }
    const next = chatReducer(current, action);
    if (next === current) {
        return;
    }
    commit({
        sessions: state.sessions,
        chats: { ...state.chats, [sessionId]: next }
    });
}

/** The controller of this chat's in-flight run, or `null` when it is idle. */
export function runController(sessionId: string): AbortController | null {
    return controllers.get(sessionId) ?? null;
}

/** Records the controller of a run that is starting. */
export function beginRun(sessionId: string, controller: AbortController): void {
    controllers.set(sessionId, controller);
}

/**
 * Forgets `controller`, but only if it is still this chat's current one — a run
 * that was cancelled and immediately replaced must not clear its replacement's
 * on the way out.
 */
export function endRun(sessionId: string, controller: AbortController): void {
    if (controllers.get(sessionId) === controller) {
        controllers.delete(sessionId);
    }
}

/**
 * Cancels the run in flight, if any.
 *
 * The controller is dropped **immediately** rather than in the run loop's own
 * `finally`, which lands a tick or more later: until it does, the chat would
 * refuse to start the next turn.
 */
export function abortRun(sessionId: string): void {
    controllers.get(sessionId)?.abort();
    controllers.delete(sessionId);
}

/** Empties the store. For tests — nothing in the app resets it. */
export function resetCopilotStore(): void {
    for (const controller of controllers.values()) {
        controller.abort();
    }
    controllers.clear();
    counter = 0;
    listeners.clear();
    state = { sessions: [], chats: {} };
}
