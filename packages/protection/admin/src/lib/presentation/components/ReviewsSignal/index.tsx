import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import {
    SignalRow,
    type InsightsSignalRowProps
} from '@orthacms/insights-admin';
import { useProtectionInsights } from '../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'protection.insights.signal.title',
        defaultMessage: 'Waiting on review'
    },
    overdueNamed: {
        id: 'protection.insights.signal.overdueNamed',
        defaultMessage:
            '{count, number} overdue — {entry}, {days, plural, one {# day} other {# days}}'
    },
    overdueType: {
        id: 'protection.insights.signal.overdueType',
        defaultMessage:
            '{count, number} overdue — oldest a {type}, {days, plural, one {# day} other {# days}}'
    },
    noneOverdue: {
        id: 'protection.insights.signal.noneOverdue',
        defaultMessage:
            'None waiting longer than {days, plural, one {# day} other {# days}}'
    },
    nothing: {
        id: 'protection.insights.signal.nothing',
        defaultMessage: 'Nothing is waiting on a review'
    }
});

/**
 * Open review requests, and the one that has waited longest — a stalled review
 * is work outstanding like any other, so it is a Needs-attention line.
 *
 * The overdue threshold arrives **with** the figure rather than being restated
 * here, so the line cannot come to say "3 days" over a number counted against
 * something else. And a failed read says so: "nothing waiting" and "we could
 * not ask" tell a reviewer opposite things.
 */
export function ReviewsSignal({ onOpen, isOpen }: InsightsSignalRowProps) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    // The slot item carries the same permission; this keeps the request off
    // the wire even if the line were mounted some other way.
    const canRead = useHasPermission('content:read');
    const { data, isPending, isError } = useProtectionInsights(
        workspace.id,
        canRead
    );

    let hint: string | undefined;
    if (data) {
        const oldest = data.oldestOpen;
        if (data.overdue > 0 && oldest) {
            hint = oldest.entryTitle
                ? intl.formatMessage(messages.overdueNamed, {
                      count: data.overdue,
                      entry: oldest.entryTitle,
                      days: oldest.waitingDays
                  })
                : intl.formatMessage(messages.overdueType, {
                      count: data.overdue,
                      type: oldest.contentTypeLabel,
                      days: oldest.waitingDays
                  });
        } else if (data.open > 0) {
            hint = intl.formatMessage(messages.noneOverdue, {
                days: data.overdueAfterDays
            });
        } else {
            hint = intl.formatMessage(messages.nothing);
        }
    }

    return (
        <SignalRow
            icon={ShieldCheck}
            tone="info"
            count={data?.open ?? 0}
            title={intl.formatMessage(messages.title)}
            hint={hint}
            isPending={isPending}
            isError={isError}
            onOpen={onOpen}
            isOpen={isOpen}
        />
    );
}
