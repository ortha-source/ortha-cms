import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import { HomeAttentionCard } from '@orthacms/shell-admin';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import { useReviewTotals } from '../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'protection.home.title',
        defaultMessage:
            '{count, plural, one {# entry awaits review} other {# entries await review}}'
    },
    where: {
        id: 'protection.home.where',
        defaultMessage: 'In {workspaces}.'
    },
    clear: {
        id: 'protection.home.clear',
        defaultMessage: 'Nothing is waiting on a reviewer.'
    },
    action: { id: 'protection.home.action', defaultMessage: 'Review' },
    open: { id: 'protection.home.open', defaultMessage: 'Open reviews' }
});

/**
 * Home's reviews card: entries awaiting approval across the reader's
 * workspaces. Shown at 0 too — an empty queue said as "0" rather than a card
 * that vanished. Renders nothing without `content:read` (the Reviews page's
 * own gate), or before the counts arrive.
 */
export function ReviewsHomeAttention() {
    const intl = useIntl();
    const canRead = useHasPermission('content:read');
    const { data: workspaces } = useWorkspaces();
    const active = (workspaces ?? []).filter(
        (workspace) => workspace.status === 'Active'
    );
    const { totals, isPending, isError } = useReviewTotals(
        active,
        canRead && active.length > 0
    );
    if (!canRead || active.length === 0 || isPending || isError) return null;

    const waiting = totals
        .filter((total) => total.waiting > 0)
        .sort((a, b) => b.waiting - a.waiting);
    const count = waiting.reduce((sum, total) => sum + total.waiting, 0);
    const target = waiting[0]?.workspaceId ?? active[0].id;

    return (
        <HomeAttentionCard
            tone={count > 0 ? 'info' : 'calm'}
            icon={ShieldCheck}
            title={intl.formatMessage(messages.title, { count })}
            description={
                count > 0
                    ? intl.formatMessage(messages.where, {
                          workspaces: intl.formatList(
                              waiting.map(
                                  (total) =>
                                      `${total.workspaceName} (${total.waiting})`
                              )
                          )
                      })
                    : intl.formatMessage(messages.clear)
            }
            action={intl.formatMessage(
                count > 0 ? messages.action : messages.open
            )}
            to={`/workspaces/${target}/reviews`}
        />
    );
}
