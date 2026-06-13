import { defineMessages, useIntl } from 'react-intl';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@ortha-cms/design-system';
import { ActivityActionCell } from '../ActivityActionCell';
import { ActivityActorCell } from '../ActivityActorCell';
import { ActivitySubjectCell } from '../ActivitySubjectCell';
import { formatActivityDetails } from '../../utils/activityMessages';
import type { ActivityEvent } from '../../types/activityEvent';

/** Intl descriptors for {@link ActivityTable}, co-located with the component. */
const messages = defineMessages({
    when: { id: 'activity.table.when', defaultMessage: 'When' },
    actor: { id: 'activity.table.actor', defaultMessage: 'Actor' },
    action: { id: 'activity.table.action', defaultMessage: 'Action' },
    subject: { id: 'activity.table.subject', defaultMessage: 'Subject' },
    details: { id: 'activity.table.details', defaultMessage: 'Details' },
    caption: { id: 'activity.table.caption', defaultMessage: 'Activity log' }
});

/**
 * The audit-log table: when an action happened, who did it, what it was, the
 * subject it targeted, and any per-kind details. Read-only — there are no row
 * actions; the log is an append-only record.
 */
export function ActivityTable({ events }: { events: ActivityEvent[] }) {
    const intl = useIntl();

    return (
        <div className="rounded-xl border">
            <Table aria-label={intl.formatMessage(messages.caption)}>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            {intl.formatMessage(messages.when)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.actor)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.action)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.subject)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.details)}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => {
                        const details = formatActivityDetails(intl, event);
                        return (
                            <TableRow key={event.id}>
                                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                    {intl.formatDate(event.at, {
                                        dateStyle: 'medium',
                                        timeStyle: 'short'
                                    })}
                                </TableCell>
                                <TableCell>
                                    <ActivityActorCell actor={event.actor} />
                                </TableCell>
                                <TableCell>
                                    <ActivityActionCell kind={event.kind} />
                                </TableCell>
                                <TableCell>
                                    <ActivitySubjectCell event={event} />
                                </TableCell>
                                <TableCell className="text-sm">
                                    {details || (
                                        <span
                                            aria-hidden
                                            className="text-muted-foreground"
                                        >
                                            —
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
