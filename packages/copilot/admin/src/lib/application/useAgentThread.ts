import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    agentThreadPath,
    agentsPath,
    readAgentThreadId
} from '../domain/agentsRoute';
import { useCopilotChat, type CopilotChat } from './useCopilotChat';
import { useConversationDetail } from './useConversation';

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
}

/**
 * Binds the URL to one chat: `/…/agents` is an unsaved chat,
 * `/…/agents/:conversationId` is that thread.
 *
 * **One `useCopilotChat`, mounted for as long as the page is.** Keying a chat
 * component by the thread id would look tidier and would be a bug: the first
 * turn of a new chat mints an id and rewrites the URL, so the key would change
 * *while the answer is streaming* and the remount would abort the run that
 * produced it. Instead the hook stays mounted and the transcript is swapped
 * underneath it.
 *
 * The URL is the single source of truth for *which* thread is open, which is
 * what makes a thread deep-linkable, reload-safe, and navigable with the
 * browser's own Back button. Three rules keep it and the chat in agreement:
 *
 * - the URL names a thread the chat is not on → the query fetches it, and the
 *   effect below loads it into the transcript
 * - the URL *changed* to the bare base → clear the transcript, because that path
 *   *is* the new-chat surface
 * - the URL was *already* the base and the chat minted an id → `replace` the URL
 *   with it (replace, not push: "new chat" and "that chat" are one step in the
 *   user's history, not two)
 *
 * **All three live in one effect, and the last two are told apart by whether the
 * URL just changed.** They were two effects, and that was a bug you could see:
 * both run in the same commit, so when New chat cleared the transcript the
 * second effect still read the *pre-reset* conversation id — a state update
 * lands on the next render, not inside the effect that asked for it — decided
 * the URL was missing an id, and pushed you straight back into the thread you
 * had just left.
 *
 * **The load is a query, not a mutation.** A mutation's per-call `onSuccess`
 * fires only while the component that called `mutate` is still mounted, and this
 * load is kicked off by an effect — React's StrictMode remount alone was enough
 * to swallow the callback and leave the page on its skeleton for good. A query
 * has no such coupling, and caching it per thread is what makes flicking between
 * two conversations instant.
 *
 * **Switching threads stops the run in flight.** The transcript it is writing
 * into is about to be replaced, so the alternative is a run dispatching text
 * into somebody else's conversation. Background runs are the dock's feature, and
 * the dock is still there — see the package's AGENTS.md.
 */
export function useAgentThread(workspaceId: string): AgentThread {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const chat = useCopilotChat(workspaceId);

    const urlId = readAgentThreadId(pathname);
    // Disabled the moment the chat is already on this thread — which is also
    // what stops the first turn of a new chat from fetching back the very
    // conversation it is streaming into, the instant it mints an id.
    const wanted = urlId && urlId !== chat.conversationId ? urlId : null;
    const detail = useConversationDetail(wanted);

    // `chat` is rebuilt on every render (its `load` and `reset` are arrows), so
    // the effects below read it through a ref rather than depending on it —
    // depending on it would re-run them on every streamed token.
    const chatRef = useRef(chat);
    chatRef.current = chat;

    const loaded = detail.data;
    const mintedId = chat.conversationId;
    /**
     * The thread the URL named last time this ran.
     *
     * It is what tells "the user just navigated to the base" apart from "we were
     * already at the base and the chat minted an id" — two situations that look
     * identical in a single render, and that call for opposite responses.
     */
    const lastUrlIdRef = useRef(urlId);

    useEffect(() => {
        const previous = lastUrlIdRef.current;
        lastUrlIdRef.current = urlId;

        if (!urlId) {
            // Arriving at the base **from a thread** is the New chat button (or
            // Back). Clear the transcript, or "new chat" would show the old one.
            if (previous !== null) {
                chatRef.current.stop();
                chatRef.current.reset();
                return;
            }
            // Already at the base, and an id has appeared: the first turn of an
            // unsaved chat just started. Put it in the URL — `replace`, because
            // "new chat" and "that chat" are one step in the user's history.
            if (mintedId) {
                navigate(agentThreadPath(workspaceId, mintedId), {
                    replace: true
                });
            }
            return;
        }

        // The URL names a thread the chat is not on: load it, once the query has
        // it. `loaded` is undefined until then, and undefined again the moment
        // the chat catches up and the query switches off.
        if (!loaded || mintedId === urlId) {
            return;
        }
        chatRef.current.stop();
        chatRef.current.load(urlId, loaded.messages);
    }, [urlId, mintedId, loaded, navigate, workspaceId]);

    const { refetch } = detail;
    const retry = useCallback(() => void refetch(), [refetch]);

    return {
        chat,
        conversationId: urlId,
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
