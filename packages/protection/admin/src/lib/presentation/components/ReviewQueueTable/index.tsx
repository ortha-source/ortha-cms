import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type { ReviewQueueItem } from '../../../domain/types';
import { ApprovalProgress } from '../ApprovalProgress';
import { RecordSummary, useRecordName } from '../RecordSummary';
import { ReviewerLabel } from '../ReviewerLabel';
import { RequestAge } from '../RequestAge';

const messages = defineMessages({
    entry: { id: 'protection.queue.col.entry', defaultMessage: 'Record' },
    requestedBy: {
        id: 'protection.queue.col.requestedBy',
        defaultMessage: 'Asked by'
    },
    reviewers: {
        id: 'protection.queue.col.reviewers',
        defaultMessage: 'Reviewers'
    },
    waiting: { id: 'protection.queue.col.waiting', defaultMessage: 'Waiting' },
    approvals: {
        id: 'protection.queue.col.approvals',
        defaultMessage: 'Approvals'
    },
    review: { id: 'protection.queue.review', defaultMessage: 'Review' },
    reviewLabel: {
        id: 'protection.queue.reviewLabel',
        defaultMessage: 'Review {entry}'
    },
    actions: { id: 'protection.queue.col.actions', defaultMessage: 'Actions' },
    caption: {
        id: 'protection.queue.caption',
        defaultMessage: 'Review requests'
    }
});

/**
 * One tab's worth of the reviewer queue — the plain design-system table every
 * other list uses, with the board's columns: the record over its type and
 * what changed, who asked, who is asked, how far the approvals have got, how
 * long it has waited, and **Review**.
 *
 * A real `<table>` with real `<th scope="col">` headers rather than a grid of
 * divs: the columns mean different things per row, and a screen reader
 * announcing "Articles, Grace, 2 days" only makes sense when each cell carries
 * its header.
 *
 * **Review opens the side panel, not the record.** It is the row's one action
 * — named "Review Pricing FAQ" so it says which row out of context — and the
 * panel offers **Open record** for a closer look. The row whose panel is open
 * is drawn selected.
 */
export function ReviewQueueTable({
    items,
    currentUserId,
    overdueAfterDays,
    selectedId,
    onReview,
    stale = false
}: {
    /** The rows for this tab, already split by `splitQueue`. */
    items: readonly ReviewQueueItem[];
    /** The signed-in person, so their own name reads "You". */
    currentUserId?: string;
    /** The server's overdue cut, passed straight through to each age. */
    overdueAfterDays: number;
    /** The row whose side panel is open, drawn selected. */
    selectedId?: string | null;
    /** Opens the side panel for a row; the button is passed for focus return. */
    onReview: (item: ReviewQueueItem, trigger: HTMLElement) => void;
    /**
     * The rows are a previous query's result while the next one loads
     * (`isPlaceholderData`) — the table dims its body and goes `aria-busy`.
     */
    stale?: boolean;
}) {
    const intl = useIntl();
    const name = useRecordName();

    return (
        <Table aria-label={intl.formatMessage(messages.caption)} stale={stale}>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.entry)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.requestedBy)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.reviewers)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.approvals)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.waiting)}
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
                            <ReviewerLabel
                                userId={item.requestedBy}
                                currentUserId={currentUserId}
                                firstName
                            />
                        </TableCell>
                        <TableCell>
                            {/* One avatar per person, overlapping; the names
                                are still in the list, for a screen reader and
                                on hover. */}
                            <ul className="flex items-center">
                                {item.reviewerIds.map((userId) => (
                                    <li
                                        key={userId}
                                        className="-ml-1.5 first:ml-0"
                                    >
                                        <ReviewerLabel
                                            userId={userId}
                                            currentUserId={currentUserId}
                                            compact
                                        />
                                    </li>
                                ))}
                            </ul>
                        </TableCell>
                        <TableCell>
                            <ApprovalProgress
                                given={item.given}
                                required={item.required}
                            />
                        </TableCell>
                        <TableCell>
                            <RequestAge
                                createdAt={item.createdAt}
                                overdueAfterDays={overdueAfterDays}
                            />
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
