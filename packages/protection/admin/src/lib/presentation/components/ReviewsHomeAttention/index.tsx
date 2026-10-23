import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck } from 'lucide-react';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { HomeAttentionCard } from '@orthacms/shell-admin';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import { useReviewTotals } from '../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'protection.home.titleMine',
        defaultMessage:
            '{count, plural, one {# entry awaits your review} other {# entries await your review}}'
    },
    asked: {
        id: 'protection.home.asked',
        defaultMessage:
            'You are waiting on reviewers for {count, plural, one {# entry} other {# entries}}.'
    },
    where: {
        id: 'protection.home.where',
        defaultMessage: 'In {workspaces}.'
    },
    clear: {
        id: 'protection.home.clear',
        defaultMessage: 'Nothing is waiting on your review.'
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
    const { user } = useAuth();
    const { data: workspaces } = useWorkspaces();
    const active = (workspaces ?? []).filter(
        (workspace) => workspace.status === 'Active'
    );
    const { totals, isPending, isError } = useReviewTotals(
        active,
        user?.id ?? '',
        canRead && active.length > 0
    );
    if (!canRead || !user || active.length === 0 || isPending || isError) {
        return null;
    }

    // What waits on *me*, as the Reviews page's default tab counts it — an
    // ask I made is waiting on somebody else, and said separately.
    const waiting = totals
        .filter((total) => total.waitingOnMe > 0)
        .sort((a, b) => b.waitingOnMe - a.waitingOnMe);
    const count = waiting.reduce((sum, total) => sum + total.waitingOnMe, 0);
    const asked = totals.reduce((sum, total) => sum + total.mine, 0);
    const target =
        waiting[0]?.workspaceId ??
        totals.find((total) => total.mine > 0)?.workspaceId ??
        active[0].id;

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
                                      `${total.workspaceName} (${total.waitingOnMe})`
                              )
                          )
                      })
                    : asked > 0
                      ? intl.formatMessage(messages.asked, { count: asked })
                      : intl.formatMessage(messages.clear)
            }
            action={intl.formatMessage(
                count > 0 ? messages.action : messages.open
            )}
            to={`/workspaces/${target}/reviews`}
        />
    );
}
