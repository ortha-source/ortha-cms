import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    agentThreadPath,
    agentsPath,
    readAgentThreadId
} from '../domain/agentsRoute';
import { copilotStoreState } from './copilotStore';
import { useCopilotChat, type CopilotChat } from './useCopilotChat';
import { useCopilotSessions } from './useCopilotSessions';
import { useConversationDetail } from './useConversation';
import { useThreadModelChoice } from './useThreadModelChoice';
import {
    readStoredModelChoice,
    type CopilotModelChoice
} from './useCopilotModels';
import type { RouteContext } from './readRouteContext';

/** What the Agents page needs to render one thread. */
export interface AgentThread {
    /** The chat driving the transcript and the composer. */
    chat: CopilotChat;
    /** The thread the URL points at, or `null` for an unsaved new chat. */
    conversationId: string | null;
    /** True while a saved thread's transcript is being fetched. */
    loading: boolean;
    /** True when that fetch failed; the page offers {@link retry}. */
    failed: boolean;
    /** Fetches the open thread again after a failure. */
    retry(): void;
    /** Which backend the next turn runs on, or `null` for the host's resolver. */
    choice: CopilotModelChoice | null;
    /**
     * Routes the next turn elsewhere. Remembered on the chat, not the page —
     * and, once the chat has a thread, written to the thread as well, so
     * reopening it tomorrow offers the same backend.
     */
    setChoice(choice: CopilotModelChoice | null): void;
    /** The page attached to the next turn. On the chat, so leaving keeps it. */
    context: RouteContext | null;
    /** Attaches the given page, or detaches with `null`. */
    setContext(context: RouteContext | null): void;
    /** The skills staged for this chat. On the chat, so leaving keeps them. */
    skills: readonly string[];
    /** Replaces the staged set. */
    setSkills(names: readonly string[]): void;
}

/**
 * The staged-skills fallback, hoisted to a constant.
 *
 * A fresh `[]` per render would be a new reference every time, and it is fed
 * straight into `useComposerSkills`'s `useMemo` — which would then recompute,
 * and hand the composer a new object, on every keystroke in the message box.
 */
const EMPTY_SKILLS: readonly string[] = [];

/**
 * Binds the URL to one chat: `/…/agents` is an unsaved chat,
 * `/…/agents/:conversationId` is that thread.
 *
 * **The page shows a chat; it does not own one.** Every chat lives in
 * `copilotStore`, so the page presents one (`presented: 'page'`) and hands it
 * back when it unmounts. That is what makes a run survive navigation: leaving
 * the Agents view mid-answer turns the chat into a **dock pill** that keeps
 * streaming, and the dock's existing "finished" / "waiting for you" markers —
 * and the tab badge — do the rest. Coming back re-presents the same chat, run
 * and all.
 *
 * `release` is where the rule about *which* chats survive lives: one with an
 * answer in flight, or parked on a permission prompt, becomes a pill; anything
 * else is closed. Keeping every thread you opened would fill the dock with
 * conversations you merely read, and they are persisted server-side and one
 * click away in the rail.
 *
 * The URL is the single source of truth for *which* thread is open, which is
 * what makes a thread deep-linkable, reload-safe, and navigable with the
 * browser's own Back button. Three rules keep it and the chat in agreement:
 *
 * - the URL names a thread this page is not presenting → present the chat
 *   already on it, or open one and load its transcript
 * - the URL is the bare base → present a fresh chat
 * - the presented chat mints a thread id → `replace` the URL with it (replace,
 *   not push: "new chat" and "that chat" are one step in the user's history)
 *
 * **The effects below run in declaration order, and that order is load-bearing.**
 * The session learns its `conversationId` *before* the URL does, so by the time
 * the reconcile effect sees the new URL it recognises the chat already on it —
 * otherwise it would file the running chat away as a pill and open a second one
 * to fetch the transcript of the answer it was already streaming.
 *
 * Switching threads no longer *stops* the one you leave — it parks it. That is
 * the store paying for itself: what used to be a cancel is now a pill with an
 * answer still coming.
 */
export function useAgentThread(workspaceId: string): AgentThread {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const sessions = useCopilotSessions();
    const urlId = readAgentThreadId(pathname);

    const [sessionId, setSessionId] = useState<string | null>(null);
    const chat = useCopilotChat(sessionId ?? '', workspaceId);

    // `sessions` and `chat` are rebuilt every render, so the effects read them
    // through refs rather than depending on them — depending on either would
    // re-run the reconcile on every streamed token.
    const sessionsRef = useRef(sessions);
    sessionsRef.current = sessions;
    const sessionIdRef = useRef<string | null>(null);
    sessionIdRef.current = sessionId;

    const mintedId = chat.conversationId;

    // 1. The session learns the thread id its chat just minted. First, because
    //    the two effects below both key off the result.
    useEffect(() => {
        const id = sessionIdRef.current;
        if (!id || !mintedId) {
            return;
        }
        sessionsRef.current.describe(id, { conversationId: mintedId });
    }, [mintedId]);

    /**
     * The thread the URL named last time this ran.
     *
     * It tells "the user just navigated to the base" apart from "we were already
     * at the base and the chat minted an id" — two situations that look
     * identical in a single render and call for opposite responses. Splitting
     * them into two effects is what breaks: both run in the same commit, so the
     * one that promotes a minted id into the URL still sees the *outgoing*
     * thread and navigates straight back to it, and New chat never leaves the
     * conversation you were on.
     */
    const lastUrlIdRef = useRef(urlId);

    // 2. Which chat this page presents, and which URL it lives at — reconciled
    //    in one pass, in this order.
    useEffect(() => {
        const previousUrlId = lastUrlIdRef.current;
        lastUrlIdRef.current = urlId;
        const urlChanged = previousUrlId !== urlId;

        const ops = sessionsRef.current;
        const currentId = sessionIdRef.current;
        const open = copilotStoreState().sessions;
        const current = currentId
            ? open.find((session) => session.id === currentId)
            : undefined;

        const adopt = (id: string) => {
            sessionIdRef.current = id;
            setSessionId(id);
        };

        if (urlId) {
            // Already on it — including the case where the chat minted this very
            // id a moment ago, thanks to effect 1 above.
            if (current?.conversationId === urlId) {
                return;
            }
            const existing = open.find(
                (session) => session.conversationId === urlId
            );
            if (current) {
                // Whatever we were showing goes back to the dock — as a live
                // pill if it has an answer coming, dropped if it does not.
                ops.release(current.id);
            }
            if (existing) {
                // A chat already running on this thread — a pill this page
                // handed back earlier, or one started from the dock. Take it
                // over rather than opening a second view of one conversation.
                ops.present(existing.id, 'page');
                adopt(existing.id);
                return;
            }
            adopt(ops.openThread(urlId, null, 'page'));
            return;
        }

        // Nothing presented yet — first mount, or React's StrictMode having
        // run this component's cleanup (which releases the chat) and then
        // mounted it again. Either way the answer is the same: this page needs
        // a chat, so make one. Gating this on `urlChanged` looked tidier and
        // left the page holding a session id that had just been closed, so
        // every message typed into it was silently dropped.
        if (!current) {
            adopt(ops.start('page'));
            return;
        }

        // The URL *changed* to the base: that is the New chat button (or Back).
        if (urlChanged) {
            ops.release(current.id);
            adopt(ops.start('page'));
            return;
        }

        // Already at the base, and an id has appeared: the first turn of an
        // unsaved chat just started. Put it in the URL — `replace`, because
        // "new chat" and "that chat" are one step in the user's history.
        if (mintedId) {
            navigate(agentThreadPath(workspaceId, mintedId), { replace: true });
        }
    }, [urlId, mintedId, navigate, workspaceId]);

    // 4. Hand the chat back on the way out — the whole point of the store.
    useEffect(
        () => () => {
            const id = sessionIdRef.current;
            if (id) {
                sessionsRef.current.release(id);
            }
        },
        []
    );

    // The dock's markers and the tab badge are driven from session state, so a
    // chat parked on a permission prompt has to say so even while it is on
    // screen — that is what makes it still marked once you navigate away. The
    // reducer ignores an unchanged value and hands back the same array, which is
    // what keeps this from looping.
    const awaiting = chat.awaitingPermission;
    useEffect(() => {
        const id = sessionIdRef.current;
        if (id) {
            sessionsRef.current.setAwaiting(id, awaiting);
        }
    }, [awaiting]);

    // A run ending is an **edge**, and only interesting off screen — which here
    // means after the chat has been handed to the dock. Reported anyway so the
    // marker rule lives in one place (`sessionsReducer` drops it for a chat that
    // is visible).
    const wasBusy = useRef(chat.busy);
    useEffect(() => {
        const id = sessionIdRef.current;
        if (id && wasBusy.current && !chat.busy) {
            sessionsRef.current.noteActivity(id);
        }
        wasBusy.current = chat.busy;
    }, [chat.busy]);

    // Fetch a transcript only when **this page's own session** is on the thread
    // the URL names and its chat is still empty.
    //
    // Both halves earn their place. Without `onThread` there is a frame, just
    // after the URL changes and just before the reconcile effect adopts, where
    // the old session is still presented — and the query fires for a thread we
    // are about to take over in memory, which is a wasted round trip and a
    // flash of "could not open this chat" if it 404s. Without the `mintedId`
    // check the first turn of a new chat would fetch back the very conversation
    // it is streaming into, the instant it mints an id.
    const presented = sessions.all.find((session) => session.id === sessionId);
    const onThread = !!urlId && presented?.conversationId === urlId;
    const wanted = onThread && urlId !== mintedId ? urlId : null;
    const detail = useConversationDetail(wanted);
    const loaded = detail.data;

    const chatRef = useRef(chat);
    chatRef.current = chat;

    useEffect(() => {
        if (!urlId || !loaded || chatRef.current.conversationId === urlId) {
            return;
        }
        chatRef.current.load(urlId, loaded.messages);
    }, [urlId, loaded]);

    // The model this thread was left on, from the same fetch that brought the
    // transcript. `null` means nobody ever picked one here — in that case the
    // chat keeps whatever the tab's own last pick seeded it with (or the
    // catalogue's first entry), and the picker is not quietly reset. A row
    // carrying the legacy `'default'` reads back as `null` too, and adopting it
    // is still right: the thread said something, even if what it said is gone.
    //
    // Adopted rather than picked (`adoptModel`, not `setModel`), so it is
    // neither written straight back to the thread it came from nor promoted to
    // the seed the next new chat inherits.
    const storedChoice = loaded?.conversation.modelChoice ?? null;
    useEffect(() => {
        const id = sessionIdRef.current;
        if (!id || !urlId || storedChoice === null) {
            return;
        }
        sessionsRef.current.adoptModel(id, readStoredModelChoice(storedChoice));
    }, [urlId, storedChoice]);

    // …and the other direction: a model the user picks here is written onto the
    // thread, so the next tab to open it starts where they left off.
    useThreadModelChoice(presented, workspaceId);

    const { refetch } = detail;
    const retry = useCallback(() => void refetch(), [refetch]);

    const setChoice = useCallback((choice: CopilotModelChoice | null) => {
        const id = sessionIdRef.current;
        if (id) {
            sessionsRef.current.setModel(id, choice);
        }
    }, []);

    const setContext = useCallback((context: RouteContext | null) => {
        const id = sessionIdRef.current;
        if (id) {
            sessionsRef.current.setContext(id, context);
        }
    }, []);

    const setSkills = useCallback((names: readonly string[]) => {
        const id = sessionIdRef.current;
        if (id) {
            sessionsRef.current.setSkills(id, names);
        }
    }, []);

    return {
        chat,
        conversationId: urlId,
        // From the session, so it survives leaving the page — which is exactly
        // what it did not do while it lived in the component.
        choice: presented?.choice ?? null,
        setChoice,
        // Likewise from the session. It was `useState` in the thread column,
        // which unmounts on leaving the view — so attaching an entry, going to
        // look at it, and coming back sent the question with no context and
        // nothing on screen to say the chip had gone.
        context: presented?.context ?? null,
        setContext,
        // Likewise from the session: leaving the page and coming back must not
        // silently drop the instructions the next turn was set up to run under.
        skills: presented?.skills ?? EMPTY_SKILLS,
        setSkills,
        // `isFetching`, not `isPending`: a disabled query stays "pending"
        // forever, and the page would never leave its skeleton.
        loading: detail.isFetching,
        failed: detail.isError,
        retry
    };
}

/** Where the rail's controls navigate. Exported so the rail needs no chat. */
export function useAgentNavigation(workspaceId: string) {
    const navigate = useNavigate();

    return {
        /** Starts an empty chat. */
        startNew: useCallback(
            () => navigate(agentsPath(workspaceId)),
            [navigate, workspaceId]
        ),
        /** Opens a saved thread. */
        select: useCallback(
            (conversationId: string) =>
                navigate(agentThreadPath(workspaceId, conversationId)),
            [navigate, workspaceId]
        )
    };
}
