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
 * - the URL is the bare base → clear the transcript, because that path *is* the
 *   new-chat surface
 * - the chat learns an id the URL does not have → `replace` the URL with it
 *   (replace, not push: "new chat" and "that chat" are one step in the user's
 *   history, not two)
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
    useEffect(() => {
        // The base path is the new-chat surface. Arriving here from a thread —
        // the rail's New chat button, or Back — has to clear the transcript, or
        // "new chat" would show the old one.
        if (!urlId) {
            if (chatRef.current.conversationId) {
                chatRef.current.stop();
                chatRef.current.reset();
            }
            return;
        }

        if (!loaded || chatRef.current.conversationId === urlId) {
            return;
        }
        chatRef.current.stop();
        chatRef.current.load(urlId, loaded.messages);
    }, [urlId, loaded]);

    const mintedId = chat.conversationId;
    useEffect(() => {
        // Only from the **base** path. Guarding on `mintedId !== urlId` instead
        // looks equivalent and is not: clicking another thread while an answer
        // streams makes the two differ, and this effect would then shove the URL
        // back to the running chat and undo the user's own navigation. When the
        // URL names a thread it is the authority; only the bare new-chat path
        // has an id to learn.
        if (!mintedId || urlId) {
            return;
        }
        navigate(agentThreadPath(workspaceId, mintedId), { replace: true });
    }, [mintedId, urlId, navigate, workspaceId]);

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
