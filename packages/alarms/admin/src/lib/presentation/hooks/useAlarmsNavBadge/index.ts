import { useQuery } from '@tanstack/react-query';
import { defineMessages, useIntl } from 'react-intl';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import type { NavBadge } from '@orthacms/shell-admin';
import { alarmsKeys } from '../../../infrastructure/alarmsKeys';
import { httpAlarmsGateway } from '../../../infrastructure/httpAlarmsGateway';
import type { AlarmSummary } from '../../../types/alarm';

const messages = defineMessages({
    errors: {
        id: 'alarms.nav.badge.errors',
        defaultMessage:
            '{count, plural, one {# alarm finding open} other {# alarm findings open}}, including errors'
    },
    warnings: {
        id: 'alarms.nav.badge.warnings',
        defaultMessage:
            '{count, plural, one {# alarm warning open} other {# alarm warnings open}}'
    }
});

/**
 * The badge a summary deserves, or `null`.
 *
 * Errors and warnings only. `info` exists so an alarm can say something
 * without asking anyone to act, and a chip in the navigation is exactly that
 * ask — counting `info` would teach everybody to ignore the number. The tone
 * is the worst severity open; the count is both together.
 */
export function alarmsBadgeOf(
    summary: AlarmSummary | undefined
): { count: number; worst: 'error' | 'warn' } | null {
    if (!summary) {
        return null;
    }
    const count = summary.open.error + summary.open.warn;
    if (count <= 0) {
        return null;
    }
    return { count, worst: summary.open.error > 0 ? 'error' : 'warn' };
}

/**
 * Open alarm findings in one workspace, as a navigation count — the Alarms row
 * in the workspace sidebar and the workspace's row in the global list.
 *
 * Keyed as `useAlarmSummary` and Home's `useAlarmTotals` key the same read, so
 * the badge, the page's figures strip and the Home card share one cache entry
 * and one answer. Polled once a minute: findings open from scans running on
 * the server, which nothing in this tab is told about. Silent while loading,
 * on a failed read, and without `alarms:read`.
 */
export function useAlarmsNavBadge(
    workspaceId: string,
    enabled = true
): NavBadge | null {
    const intl = useIntl();
    const canRead = useHasPermission('alarms:read');
    const active = enabled && canRead && Boolean(workspaceId);
    const { data } = useQuery({
        queryKey: alarmsKeys.summary(workspaceId),
        queryFn: () => httpAlarmsGateway.summary(workspaceId),
        enabled: active,
        staleTime: 30_000,
        refetchInterval: 60_000,
        retry: 1
    });
    const badge = active ? alarmsBadgeOf(data) : null;
    if (!badge) {
        return null;
    }
    const isError = badge.worst === 'error';
    return {
        count: badge.count,
        tone: isError ? 'destructive' : 'warning',
        icon: isError ? CircleAlert : TriangleAlert,
        label: intl.formatMessage(
            isError ? messages.errors : messages.warnings,
            {
                count: badge.count
            }
        )
    };
}
