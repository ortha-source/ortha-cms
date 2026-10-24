import { useQuery } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@orthacms/utils-admin';

/** A content type an opener is about. */
export interface SuggestionType {
    name: string;
    label: string;
    kind: 'collection' | 'single';
    owned: boolean;
}

/**
 * One opener on the new-chat page, as `GET /api/copilot/suggestions` returns
 * it — **structured, never prose**. The server decides which openers make
 * sense for this workspace and this caller; the admin words them
 * (`AgentsWelcome`), so they translate with the rest of the UI.
 */
export type CopilotSuggestion =
    | { kind: 'missing-summary'; type: SuggestionType }
    | { kind: 'recent-changes' }
    | { kind: 'translate'; type: SuggestionType }
    | {
          kind: 'check-skill';
          type: SuggestionType;
          skill: { name: string; title: string };
      }
    | { kind: 'draft-new'; type: SuggestionType }
    | { kind: 'content-types' };

/** Query key for one workspace's openers — invalidated by a skill write. */
export const suggestionsKey = (workspaceId: string) =>
    ['copilot', 'suggestions', workspaceId] as const;

/**
 * The openers for a new chat in `workspaceId`.
 *
 * `STALE_TIME.Standard`: they change when the workspace's types, skills or
 * the caller's role do — rarely, and a skill write invalidates them anyway.
 */
export function useCopilotSuggestions(workspaceId: string | null) {
    return useQuery({
        queryKey: suggestionsKey(workspaceId ?? ''),
        enabled: Boolean(workspaceId),
        staleTime: STALE_TIME.Standard,
        queryFn: async (): Promise<CopilotSuggestion[]> => {
            const response = await apiClient.get<CopilotSuggestion[]>(
                '/copilot/suggestions'
            );
            return Array.isArray(response.data) ? response.data : [];
        }
    });
}
