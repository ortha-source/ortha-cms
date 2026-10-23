import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { TableCell, TableRow } from '@orthacms/design-system';
import type {
    WebhookEndpoint,
    WebhookEventOption
} from '../../../../domain/types/webhook';
import type { WorkspaceOption } from '../../../../domain/types/workspaceOption';
import { isStopped, successRate } from '../../../../domain/webhookHealth';
import { useWebhookDeliveries } from '../../../../application/useWebhookDeliveries';
import { useFormatSince } from '../../../hooks/useFormatSince';
import { WebhookStateBadge } from '../../WebhookStateBadge';
import { HealthStrip } from './HealthStrip';

/** How many recent deliveries the strip draws. */
export const HEALTH_SLOTS = 20;

const messages = defineMessages({
    allEvents: { id: 'webhooks.table.allEvents', defaultMessage: 'All events' },
    someEvents: {
        id: 'webhooks.table.someEvents',
        defaultMessage: '{count, plural, one {# event} other {# events}}'
    },
    allWorkspaces: {
        id: 'webhooks.table.allWorkspacesLower',
        defaultMessage: 'all workspaces'
    },
    someWorkspaces: {
        id: 'webhooks.table.someWorkspaces',
        defaultMessage:
            '{count, plural, one {# workspace} other {# workspaces}}'
    },
    someTypes: {
        id: 'webhooks.table.someTypes',
        defaultMessage: '{count, plural, one {# type} other {# types}}'
    },
    rate: {
        id: 'webhooks.table.rate',
        defaultMessage: '{rate, number}%'
    },
    rateLabel: {
        id: 'webhooks.table.rateLabel',
        defaultMessage:
            '{rate, number}% of the last {count, plural, one {# delivery} other {# deliveries}} succeeded'
    },
    noRate: {
        id: 'webhooks.table.noRate',
        defaultMessage: 'No finished deliveries yet'
    },
    never: { id: 'webhooks.table.never', defaultMessage: 'Nothing sent yet' },
    duration: {
        id: 'webhooks.table.duration',
        defaultMessage: '{ms, number} ms'
    },
    afterFailures: {
        id: 'webhooks.table.afterFailures',
        defaultMessage:
            'after {count, plural, one {# failure} other {# failures}}'
    },
    noResponse: {
        id: 'webhooks.table.noResponse',
        defaultMessage: 'no response'
    }
});

type WebhookRowProps = {
    endpoint: WebhookEndpoint;
    /** The event catalogue, for labels; empty until it loads. */
    events: WebhookEventOption[];
    /** The workspace list, for names; empty until it loads. */
    workspaces: WorkspaceOption[];
};

/**
 * One endpoint in the list: its name over its URL, what it sends in one line,
 * its last {@link HEALTH_SLOTS} deliveries, its state and its last delivery.
 *
 * Each row reads its own first page of the log — the same query the detail
 * page's log polls, so it keeps polling only while a delivery is in flight.
 */
export function WebhookRow({ endpoint, events, workspaces }: WebhookRowProps) {
    const intl = useIntl();
    const since = useFormatSince();
    const { data } = useWebhookDeliveries(endpoint.id, {
        page: 1,
        pageSize: HEALTH_SLOTS
    });
    const deliveries = data?.items ?? [];
    const rate = data ? successRate(deliveries) : null;

    const workspaceName = (id: string) =>
        workspaces.find((workspace) => workspace.id === id)?.name;
    const eventLabels = endpoint.eventKinds.map(
        (kind) => events.find((event) => event.kind === kind)?.label
    );
    const sends = [
        endpoint.eventKinds.length === 0
            ? intl.formatMessage(messages.allEvents)
            : endpoint.eventKinds.length <= 2 && eventLabels.every(Boolean)
              ? intl.formatList(eventLabels as string[])
              : intl.formatMessage(messages.someEvents, {
                    count: endpoint.eventKinds.length
                }),
        endpoint.allWorkspaces
            ? intl.formatMessage(messages.allWorkspaces)
            : endpoint.workspaceIds.length === 1 &&
                workspaceName(endpoint.workspaceIds[0])
              ? workspaceName(endpoint.workspaceIds[0])
              : intl.formatMessage(messages.someWorkspaces, {
                    count: endpoint.workspaceIds.length
                }),
        endpoint.contentTypes.length > 0
            ? intl.formatMessage(messages.someTypes, {
                  count: endpoint.contentTypes.length
              })
            : null
    ].filter(Boolean);

    const last = endpoint.lastDelivery;
    const latest = deliveries[0];
    const detail = last
        ? [
              last.statusCode !== null
                  ? String(last.statusCode)
                  : intl.formatMessage(messages.noResponse),
              isStopped(endpoint)
                  ? intl.formatMessage(messages.afterFailures, {
                        count: endpoint.consecutiveFailures
                    })
                  : latest?.id === last.id && latest.durationMs !== null
                    ? intl.formatMessage(messages.duration, {
                          ms: latest.durationMs
                      })
                    : null
          ]
              .filter(Boolean)
              .join(' · ')
        : null;

    return (
        <TableRow>
            <TableCell className="max-w-0 py-3">
                <Link
                    to={`/webhooks/${endpoint.id}`}
                    className="block truncate font-medium underline-offset-4 hover:underline focus-visible:underline"
                >
                    {endpoint.name}
                </Link>
                <div className="truncate font-mono text-xs text-muted-foreground">
                    {endpoint.url}
                </div>
            </TableCell>
            <TableCell className="text-[13px] text-muted-foreground">
                {sends.join(' · ')}
            </TableCell>
            <TableCell>
                <span className="flex items-center gap-2">
                    <HealthStrip deliveries={deliveries} slots={HEALTH_SLOTS} />
                    <span
                        aria-hidden
                        className="text-xs tabular-nums text-muted-foreground"
                    >
                        {rate === null
                            ? '—'
                            : intl.formatMessage(messages.rate, { rate })}
                    </span>
                    <span className="sr-only">
                        {rate === null
                            ? intl.formatMessage(messages.noRate)
                            : intl.formatMessage(messages.rateLabel, {
                                  rate,
                                  count: deliveries.length
                              })}
                    </span>
                </span>
            </TableCell>
            <TableCell>
                <WebhookStateBadge endpoint={endpoint} />
            </TableCell>
            <TableCell className="text-xs leading-4">
                {last ? (
                    <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                            {since(last.createdAt)}
                        </span>
                        {detail ? (
                            <span className="text-muted-foreground">
                                {detail}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-muted-foreground">
                        {intl.formatMessage(messages.never)}
                    </span>
                )}
            </TableCell>
        </TableRow>
    );
}
