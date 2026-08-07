import { useQuery } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@ortha-cms/utils-admin';

/** A thread as the list renders it. */
export interface CopilotConversation {
    id: string;
    title: string | null;
    surface: string;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Query key for one workspace's thread list. */
export const conversationsKey = (workspaceId: string) =>
    ['copilot', 'conversations', workspaceId] as const;

/**
 * The signed-in user's threads in the open workspace, most recently used first.
 *
 * Reads through the shared `apiClient` — this is an ordinary JSON request, and
 * only the run route needs the bespoke `fetch` transport.
 */
export function useConversations(workspaceId: string | undefined) {
    return useQuery({
        queryKey: conversationsKey(workspaceId ?? ''),
        enabled: !!workspaceId,
        staleTime: STALE_TIME.Short,
        queryFn: async (): Promise<CopilotConversation[]> => {
            const response = await apiClient.get<{
                items: CopilotConversation[];
            }>('/copilot/conversations');
            return response.data.items;
        }
    });
}
