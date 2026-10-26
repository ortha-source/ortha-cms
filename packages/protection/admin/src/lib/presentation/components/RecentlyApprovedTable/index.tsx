import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type { RecentlyApprovedItem } from '../../../domain/types';
import { ApprovalProgress } from '../ApprovalProgress';
import { RecordSummary, useRecordName } from '../RecordSummary';
import { ReviewerLabel } from '../ReviewerLabel';

const messages = defineMessages({
    entry: { id: 'protection.queue.col.entry', defaultMessage: 'Record' },
    requestedBy: {
        id: 'protection.queue.col.requestedBy',
        defaultMessage: 'Asked by'
    },
    approvals: {
        id: 'protection.queue.col.approvals',
        defaultMessage: 'Approvals'
    },
    approved: {
        id: 'protection.approved.col.approved',
        defaultMessage: 'You approved'
    },
    state: { id: 'protection.approved.col.state', defaultMessage: 'Now' },
    nobody: {
        id: 'protection.approved.nobodyAsked',
        defaultMessage: 'Nobody asked'
    },
    live: { id: 'protection.approved.live', defaultMessage: 'Published' },
    changed: {
        id: 'protection.approved.changed',
        defaultMessage: 'Changed since'
    },
    counts: {
        id: 'protection.approved.counts',
        defaultMessage: 'Still counts'
    },
    review: { id: 'protection.queue.review', defaultMessage: 'Review' },
    reviewLabel: {
        id: 'protection.queue.reviewLabel',
        defaultMessage: 'Review {entry}'
    },
    actions: { id: 'protection.queue.col.actions', defaultMessage: 'Actions' },
    caption: {
        id: 'protection.approved.caption',
        defaultMessage: 'Recently approved'
    }
});

/** Whole days between `iso` and now, for a relative "2 days ago". */
function daysSince(iso: string): number {
    const at = Date.parse(iso);
    if (Number.isNaN(at)) return 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfThen = new Date(at);
    startOfThen.setHours(0, 0, 0, 0);
    return Math.max(
        0,
        Math.round(
            (startOfToday.getTime() - startOfThen.getTime()) / 86_400_000
        )
    );
}

/**
 * "Recently approved" — what the reader approved lately, one line per record,
 * answering *did I already approve that?*
 *
 * The last column says where the approval stands **now**, in words: the record
 * went live with it (**Published**), a save moved past it so it no longer
 * counts (**Changed since** — Review shows what changed), or it is still on the
 * current version and still counts. The same table as the queue's, minus the
 * waiting time, which is no longer the reader's to worry about.
 */
export function RecentlyApprovedTable({
    items,
    currentUserId,
    selectedId,
    onReview
}: {
    items: readonly RecentlyApprovedItem[];
    currentUserId?: string;
    selectedId?: string | null;
    onReview: (item: RecentlyApprovedItem, trigger: HTMLElement) => void;
}) {
    const intl = useIntl();
    const name = useRecordName();

    return (
        <Table aria-label={intl.formatMessage(messages.caption)}>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.entry)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.requestedBy)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.approvals)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.approved)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.state)}
                    </TableHead>
                    <TableHead scope="col">
                        <span className="sr-only">
                            {intl.formatMessage(messages.actions)}
                        </span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item) => (
                    <TableRow
                        key={item.id}
                        data-state={
                            item.id === selectedId ? 'selected' : undefined
                        }
                    >
                        <TableCell>
                            <RecordSummary item={item} />
                        </TableCell>
                        <TableCell>
                            {item.requestedBy ? (
                                <ReviewerLabel
                                    userId={item.requestedBy}
                                    currentUserId={currentUserId}
                                    firstName
                                />
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    {intl.formatMessage(messages.nobody)}
                                </span>
                            )}
                        </TableCell>
                        <TableCell>
                            <ApprovalProgress
                                given={item.given}
                                required={item.required}
                            />
                        </TableCell>
                        <TableCell>
                            <time
                                dateTime={item.approvedAt}
                                className="whitespace-nowrap text-sm"
                            >
                                {intl.formatRelativeTime(
                                    -daysSince(item.approvedAt),
                                    'day',
                                    { numeric: 'auto' }
                                )}
                            </time>
                        </TableCell>
                        <TableCell>
                            {item.headPublished && item.approvalCurrent ? (
                                <Badge variant="success" size="xs">
                                    {intl.formatMessage(messages.live)}
                                </Badge>
                            ) : item.approvalCurrent ? (
                                <Badge variant="muted" size="xs">
                                    {intl.formatMessage(messages.counts)}
                                </Badge>
                            ) : (
                                <Badge variant="warning" size="xs">
                                    {intl.formatMessage(messages.changed)}
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={intl.formatMessage(
                                    messages.reviewLabel,
                                    { entry: name(item) }
                                )}
                                onClick={(event) =>
                                    onReview(item, event.currentTarget)
                                }
                            >
                                {intl.formatMessage(messages.review)}
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
