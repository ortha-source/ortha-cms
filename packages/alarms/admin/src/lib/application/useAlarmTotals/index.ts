import { useQueries } from '@tanstack/react-query';
import { alarmsKeys } from '../../infrastructure/alarmsKeys';
import { httpAlarmsGateway } from '../../infrastructure/httpAlarmsGateway';

/** One workspace's open findings, for a page outside any workspace. */
export type WorkspaceAlarmTotal = {
    workspaceId: string;
    workspaceName: string;
    open: number;
};

/**
 * Open finding counts per workspace, for Home — which sits outside every
 * workspace, so it asks each one in turn. Keyed as `useAlarmSummary` keys its
 * own read, so the in-workspace nav badge and this share cache.
 */
export function useAlarmTotals(
    workspaces: readonly { id: string; name: string }[],
    enabled = true
) {
    const results = useQueries({
        queries: workspaces.map((workspace) => ({
            queryKey: alarmsKeys.summary(workspace.id),
            queryFn: () => httpAlarmsGateway.summary(workspace.id),
            enabled
        }))
    });
    const totals: WorkspaceAlarmTotal[] = [];
    workspaces.forEach((workspace, index) => {
        const data = results[index].data;
        if (data) {
            totals.push({
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                open: data.openTotal
            });
        }
    });
    return {
        totals,
        isPending: results.some((result) => result.isPending),
        isError: results.length > 0 && results.every((r) => r.isError)
    };
}
