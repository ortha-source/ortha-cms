import { defineMessages, useIntl } from 'react-intl';
import { BellRing } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import { HomeAttentionCard } from '@orthacms/shell-admin';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import { useAlarmTotals } from '../../../application/useAlarmTotals';

const messages = defineMessages({
    title: {
        id: 'alarms.home.title',
        defaultMessage:
            '{count, plural, one {# open finding} other {# open findings}}'
    },
    where: {
        id: 'alarms.home.where',
        defaultMessage: 'In {workspaces}.'
    },
    clear: {
        id: 'alarms.home.clear',
        defaultMessage: 'Every alarm check passes in your workspaces.'
    },
    action: { id: 'alarms.home.action', defaultMessage: 'See findings' },
    open: { id: 'alarms.home.open', defaultMessage: 'Open alarms' }
});

/**
 * Home's alarms card: open findings across the reader's workspaces, and
 * where they are. Shown at 0 too — an empty queue said as "0" rather than a
 * card that vanished. Renders nothing without `alarms:read`, or before the
 * counts arrive.
 */
export function AlarmsHomeAttention() {
    const intl = useIntl();
    const canRead = useHasPermission('alarms:read');
    const { data: workspaces } = useWorkspaces();
    const active = (workspaces ?? []).filter(
        (workspace) => workspace.status === 'Active'
    );
    const { totals, isPending, isError } = useAlarmTotals(
        active,
        canRead && active.length > 0
    );
    if (!canRead || active.length === 0 || isPending || isError) return null;

    const flagged = totals
        .filter((total) => total.open > 0)
        .sort((a, b) => b.open - a.open);
    const count = flagged.reduce((sum, total) => sum + total.open, 0);
    const target = flagged[0]?.workspaceId ?? active[0].id;

    return (
        <HomeAttentionCard
            tone={count > 0 ? 'warning' : 'calm'}
            icon={BellRing}
            title={intl.formatMessage(messages.title, { count })}
            description={
                count > 0
                    ? intl.formatMessage(messages.where, {
                          workspaces: intl.formatList(
                              flagged.map(
                                  (total) =>
                                      `${total.workspaceName} (${total.open})`
                              )
                          )
                      })
                    : intl.formatMessage(messages.clear)
            }
            action={intl.formatMessage(
                count > 0 ? messages.action : messages.open
            )}
            to={`/workspaces/${target}/alarms`}
        />
    );
}
