import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import { conversationKey } from './useConversation';
import {
    conversationsScopeKey,
    type CopilotConversation
} from './useConversations';

/** What one PATCH may change. Both optional; the server rejects neither. */
export interface ConversationPatch {
    /** A new display title. */
    title?: string;
    /** Hide the thread from the list, or bring it back. */
    archived?: boolean;
}

/**
 * Renames a thread, or files it away.
 *
 * `PATCH /copilot/conversations/:id`. Invalidates **both** thread-list keys —
 * active and archived — because every operation this hook performs moves a row
 * between them, and refreshing only the list the user is looking at leaves the
 * other one stale behind their back. It also invalidates that thread's own
 * transcript key, whose cached copy carries the title.
 */
export function useUpdateConversation(workspaceId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            conversationId,
            patch
        }: {
            conversationId: string;
            patch: ConversationPatch;
        }) => {
            const { data } = await apiClient.patch<CopilotConversation>(
                `/copilot/conversations/${conversationId}`,
                patch
            );
            return data;
        },
        onSuccess: (_data, { conversationId }) => {
            void queryClient.invalidateQueries({
                queryKey: conversationsScopeKey(workspaceId)
            });
            void queryClient.invalidateQueries({
                queryKey: conversationKey(conversationId)
            });
        }
    });
}
