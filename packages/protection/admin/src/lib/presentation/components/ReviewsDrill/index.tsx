import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { DrillRecordRow, SignalDrill } from '@orthacms/insights-admin';
import { useReviewQueue } from '../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'protection.insights.drill.title',
        defaultMessage: 'Waiting on review'
    },
    description: {
        id: 'protection.insights.drill.description',
        defaultMessage:
            'Open review requests in this workspace, the longest-waiting first.'
    },
    meta: {
        id: 'protection.insights.drill.meta',
        defaultMessage:
            '{type} · waiting {days, plural, one {# day} other {# days}}'
    },
    metaOverdue: {
        id: 'protection.insights.drill.metaOverdue',
        defaultMessage:
            '{type} · waiting {days, plural, one {# day} other {# days}} · overdue'
    },
    untitled: {
        id: 'protection.insights.drill.untitled',
        defaultMessage: 'Untitled ({id})'
    },
    requestedBy: {
        id: 'protection.insights.drill.requestedBy',
        defaultMessage: 'Requested by {name}'
    },
    openAll: {
        id: 'protection.insights.drill.openAll',
        defaultMessage: 'Open all {count, number} in Reviews'
    },
    empty: {
        id: 'protection.insights.drill.empty',
        defaultMessage: 'Nothing is waiting on a review.'
    }
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The records behind "Waiting on review": each open request, the
 * longest-waiting first, with who asked — and the way to the Reviews queue,
 * where they can be reviewed.
 *
 * Reads the Reviews page's own first page under its own key, so opening the
 * panel and then the page costs one request between them.
 */
export function ReviewsDrill() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const { data, isPending, isError } = useReviewQueue(workspace.id);

    const now = Date.now();
    const items = [...(data?.items ?? [])].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
    );

    return (
        <SignalDrill
            title={intl.formatMessage(messages.title)}
            count={data?.total}
            description={intl.formatMessage(messages.description)}
            isPending={isPending}
            isError={isError}
            isEmpty={!!data && data.total === 0}
            emptyMessage={intl.formatMessage(messages.empty)}
            actions={
                data && data.total > 0 ? (
                    <Button asChild variant="outline" size="sm">
                        <Link to="../reviews">
                            <ArrowRight aria-hidden="true" />
                            {intl.formatMessage(messages.openAll, {
                                count: data.total
                            })}
                        </Link>
                    </Button>
                ) : null
            }
        >
            {items.map((item) => {
                const days = Math.max(
                    0,
                    Math.floor((now - Date.parse(item.createdAt)) / DAY_MS)
                );
                const overdue = data && days >= data.overdueAfterDays;
                return (
                    <DrillRecordRow
                        key={item.id}
                        to={`../content/${item.contentType}/${item.entryId}`}
                        title={
                            item.entryTitle ??
                            intl.formatMessage(messages.untitled, {
                                id: item.entryId.slice(0, 8)
                            })
                        }
                        meta={intl.formatMessage(
                            overdue ? messages.metaOverdue : messages.meta,
                            { type: item.contentTypeLabel, days }
                        )}
                        personId={item.requestedBy}
                        personLabel={(name) =>
                            intl.formatMessage(messages.requestedBy, { name })
                        }
                    />
                );
            })}
        </SignalDrill>
    );
}
