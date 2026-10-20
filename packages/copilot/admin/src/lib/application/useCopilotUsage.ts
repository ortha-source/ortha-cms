import { useQuery } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@orthacms/utils-admin';

/** What `GET /api/copilot/usage` returns, with `resetsAt` parsed. */
export interface CopilotUsage {
    /** The UTC day being counted, `YYYY-MM-DD`. */
    day: string;
    /** When every daily quota starts over. */
    resetsAt: Date;
    /** The caller's own spend in this workspace; `limit` is `null` with no quota. */
    user: { used: number; limit: number | null };
    /** Only whether the workspace's quota is spent — the server sends no figure. */
    workspace: { exhausted: boolean };
}

/** The wire shape, before `resetsAt` becomes a `Date`. */
type CopilotUsageResponse = Omit<CopilotUsage, 'resetsAt'> & {
    resetsAt: string;
};

/**
 * Query key for one workspace's usage. Invalidated when a run ends — which is
 * when the spend it shows changes — and when a run is refused by a limit.
 */
export const usageKey = (workspaceId: string) =>
    ['copilot', 'usage', workspaceId] as const;

/**
 * Today's copilot spend for the signed-in user in `workspaceId`, for the meter
 * under the composer.
 *
 * `STALE_TIME.Short` plus invalidation on every run's end, rather than a poll:
 * the figure changes when *this* person runs something, which the chat already
 * knows about. A colleague exhausting the workspace's quota is the one change
 * this misses until the next refetch — and the run route refuses with a `429`
 * the panel words the same way, so it is not missed for long.
 */
export function useCopilotUsage(workspaceId: string | null) {
    return useQuery({
        queryKey: usageKey(workspaceId ?? ''),
        enabled: Boolean(workspaceId),
        staleTime: STALE_TIME.Short,
        queryFn: async (): Promise<CopilotUsage> => {
            // `X-Workspace-Id` rides the shared client's interceptor, like
            // every other workspace-scoped read in this package.
            const response =
                await apiClient.get<CopilotUsageResponse>('/copilot/usage');
            return {
                ...response.data,
                resetsAt: new Date(response.data.resetsAt)
            };
        }
    });
}
