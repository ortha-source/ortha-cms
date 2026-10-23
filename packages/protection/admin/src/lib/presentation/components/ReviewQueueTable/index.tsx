import { Link } from 'react-router-dom';
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
import { ReviewerLabel } from '../ReviewerLabel';
import { RequestAge } from '../RequestAge';

const messages = defineMessages({
    entry: { id: 'protection.queue.col.entry', defaultMessage: 'Record' },
    type: { id: 'protection.queue.col.type', defaultMessage: 'Type' },
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
    tally: {
        id: 'protection.queue.tallyShort',
        defaultMessage: '{given} of {required}'
    },
    tallyNoun: {
        id: 'protection.queue.tallyNoun',
        defaultMessage: 'approvals'
    },
    review: { id: 'protection.queue.review', defaultMessage: 'Review' },
    actions: { id: 'protection.queue.col.actions', defaultMessage: 'Actions' },
    open: { id: 'protection.queue.open', defaultMessage: 'Open {entry}' },
    caption: {
        id: 'protection.queue.caption',
        defaultMessage: 'Review requests'
    }
});

/**
 * One tab's worth of the reviewer queue.
 *
 * A real `<table>` with real `<th scope="col">` headers rather than a grid of
 * divs: the columns mean different things per row, and a screen reader
 * announcing "Articles, Anna Kovalyova, 2 days waiting" only makes sense when
 * each cell carries its header.
 *
 * **The tally is a sentence, not a fragment.** "1 of 2" read aloud out of a row
 * is a pair of numbers with no subject; the cell says "1 of 2 approvals" so it
 * is comprehensible wherever it is read from — which is the same reason the
 * entry editor's chip spells its own count out.
 */
export function ReviewQueueTable({
    items,
    currentUserId,
    overdueAfterDays,
    stale = false
}: {
    /** The rows for this tab, already split by `splitQueue`. */
    items: readonly ReviewQueueItem[];
    /** The signed-in person, so their own name reads "You". */
    currentUserId?: string;
    /** The server's overdue cut, passed straight through to each age. */
    overdueAfterDays: number;
    /**
     * The rows are a previous query's result while the next one loads
     * (`isPlaceholderData`) — the table dims its body and goes `aria-busy`.
     */
    stale?: boolean;
}) {
    const intl = useIntl();

    return (
        <div>
            <Table
                aria-label={intl.formatMessage(messages.caption)}
                stale={stale}
            >
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
                            {intl.formatMessage(messages.waiting)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.approvals)}
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
                        <TableRow key={item.id}>
                            <TableCell>
                                {/* The record by its title, as every other list
                                names one. An entry with nothing to show falls
                                back to a fragment of its id, and the link text
                                then says "Open …" so it still names what it
                                opens out of context. */}
                                <Link
                                    to={`../content/${item.contentType}/${item.entryId}`}
                                    className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                                >
                                    {item.entryTitle ??
                                        intl.formatMessage(messages.open, {
                                            entry: item.entryId.slice(0, 8)
                                        })}
                                </Link>
                                {/* The type under the title, as every other
                                    list names a record and what it is. */}
                                <div className="text-xs text-muted-foreground">
                                    {item.contentTypeLabel}
                                </div>
                            </TableCell>
                            <TableCell>
                                <ReviewerLabel
                                    userId={item.requestedBy}
                                    currentUserId={currentUserId}
                                />
                            </TableCell>
                            <TableCell>
                                {/* One avatar per person, overlapping; the
                                    names are still in the list, for a screen
                                    reader and on hover. */}
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
                                <RequestAge
                                    createdAt={item.createdAt}
                                    overdueAfterDays={overdueAfterDays}
                                />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                <span
                                    aria-hidden
                                    className="mr-2 inline-flex gap-0.5 align-middle"
                                >
                                    {Array.from(
                                        { length: item.required },
                                        (_, index) => (
                                            <i
                                                key={index}
                                                className={
                                                    index < item.given
                                                        ? 'block h-1.5 w-3.5 rounded-full bg-success'
                                                        : 'block h-1.5 w-3.5 rounded-full bg-muted'
                                                }
                                            />
                                        )
                                    )}
                                </span>
                                {intl.formatMessage(messages.tally, {
                                    given: item.given,
                                    required: item.required
                                })}{' '}
                                <span className="sr-only">
                                    {intl.formatMessage(messages.tallyNoun)}
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        to={`../content/${item.contentType}/${item.entryId}`}
                                        tabIndex={-1}
                                    >
                                        {intl.formatMessage(messages.review)}
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
