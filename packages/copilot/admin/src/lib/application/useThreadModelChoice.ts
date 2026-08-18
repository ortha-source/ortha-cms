import { useEffect } from 'react';
import type { CopilotSession } from './sessions';
import { storedModelChoice } from './useCopilotModels';
import { useUpdateConversation } from './useUpdateConversation';

/**
 * Writes a chat's **picked** model onto the thread it belongs to.
 *
 * The last of the three places a choice is remembered, and the only one that
 * outlives the tab: the session keeps it across an unmount, the store's seed
 * keeps it across closing the chat, and this keeps it across a reload, another
 * tab, and another day. Reopening a saved conversation then offers the backend
 * the person chose for it rather than silently falling back to the house
 * default — which is the half of the forgetting the client alone could never
 * fix.
 *
 * Three rules, each of them the difference between a memory and a nuisance:
 *
 * - **Only a pick is written.** `choicePinned` is false for a chat that merely
 *   inherited the tab's last model, and for one that adopted the thread's own —
 *   so a new conversation does not get a decision nobody made recorded against
 *   it, and opening a thread does not echo its own value straight back.
 * - **Only once there is a thread to write to.** A brand-new chat has no
 *   `conversationId`; picking a model before the first turn is remembered on the
 *   session and lands the moment the run mints one, because that is when this
 *   effect's dependencies change.
 * - **It is a memory, not a pin.** The run route still carries provider and
 *   model per turn; this only decides what the picker is *seeded* with next
 *   time.
 *
 * Called by whichever surface is currently showing the chat — `CopilotSession`
 * for a dock window, `useAgentThread` for the full page. Exactly one of the two
 * has any given chat, so there is no double write.
 */
export function useThreadModelChoice(
    session: CopilotSession | undefined,
    workspaceId: string
): void {
    const { mutate } = useUpdateConversation(workspaceId);

    const conversationId = session?.conversationId ?? null;
    const pinned = session?.choicePinned ?? false;
    // A string rather than the object, so the effect compares by value — the
    // session hands back a fresh `choice` object on every store publication.
    // `null` cannot reach here with `pinned` true (a pick is always a real
    // backend now that the picker has no "Default" row), and the guard below
    // makes that structural rather than assumed.
    const choice = session?.choice ? storedModelChoice(session.choice) : null;

    useEffect(() => {
        if (!conversationId || !pinned || !choice) {
            return;
        }
        mutate({ conversationId, patch: { modelChoice: choice } });
    }, [conversationId, pinned, choice, mutate]);
}
