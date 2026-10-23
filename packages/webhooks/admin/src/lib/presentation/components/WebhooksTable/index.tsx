import { defineMessages, useIntl } from 'react-intl';
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type {
    WebhookEndpoint,
    WebhookEventOption
} from '../../../domain/types/webhook';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';
import { HEALTH_SLOTS, WebhookRow } from './WebhookRow';

const messages = defineMessages({
    caption: {
        id: 'webhooks.table.caption',
        defaultMessage: 'Configured webhook endpoints'
    },
    name: { id: 'webhooks.table.webhook', defaultMessage: 'Webhook' },
    events: { id: 'webhooks.table.events', defaultMessage: 'Sends' },
    health: {
        id: 'webhooks.table.health',
        defaultMessage: 'Last {count, number} deliveries'
    },
    state: { id: 'webhooks.table.state', defaultMessage: 'State' },
    lastDelivery: {
        id: 'webhooks.table.lastDelivery',
        defaultMessage: 'Last delivery'
    }
});

type WebhooksTableProps = {
    endpoints: WebhookEndpoint[];
    events: WebhookEventOption[];
    workspaces: WorkspaceOption[];
};

/**
 * The endpoint list: one row per endpoint, each saying where it sends, what,
 * how its recent deliveries went, and its state — "is anything broken?" is
 * the question the page is opened to answer.
 */
export function WebhooksTable({
    endpoints,
    events,
    workspaces
}: WebhooksTableProps) {
    const intl = useIntl();

    return (
        <div className="overflow-hidden rounded-xl border">
            <Table className="min-w-[860px] table-fixed">
                <caption className="sr-only">
                    {intl.formatMessage(messages.caption)}
                </caption>
                <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[22%]" />
                    <col className="w-[180px]" />
                    <col className="w-[110px]" />
                    <col className="w-[150px]" />
                </colgroup>
                <TableHeader className="bg-muted/40">
                    <TableRow>
                        <TableHead>
                            {intl.formatMessage(messages.name)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.events)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.health, {
                                count: HEALTH_SLOTS
                            })}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.state)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.lastDelivery)}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {endpoints.map((endpoint) => (
                        <WebhookRow
                            key={endpoint.id}
                            endpoint={endpoint}
                            events={events}
                            workspaces={workspaces}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
