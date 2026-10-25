import { defineMessages, useIntl } from 'react-intl';
import { Check, RefreshCw } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Spinner
} from '@orthacms/design-system';
import { activityDateTime } from '../../../activityDateTime';
import { formatActivityAction } from '../../../activityMessages';
import { auditKindOf } from '../../../deadLetterKind';
import type { DeadLetter } from '../../../../types/deadLetter';

/** Intl descriptors for {@link DeadLettersDialog}, co-located with the component. */
const messages = defineMessages({
    dialogTitle: {
        id: 'activity.deadLetters.dialogTitle',
        defaultMessage:
            '{count, plural, =0 {Every action is recorded} one {# action was not recorded} other {# actions were not recorded}}'
    },
    dialogDescription: {
        id: 'activity.deadLetters.dialogDescription',
        // "Retrying is safe" is a statement about `activity:I-03` — the audit
        // insert is `ON CONFLICT DO NOTHING`, so a repeat is ignored — and it
        // is why there is no confirmation step.
        defaultMessage:
            'The log is incomplete until they are recorded. Retrying is safe — nothing is done twice.'
    },
    listLabel: {
        id: 'activity.deadLetters.listLabel',
        defaultMessage: 'Events that could not be recorded'
    },
    attempts: {
        id: 'activity.deadLetters.attempts',
        defaultMessage: '{count, plural, one {# attempt} other {# attempts}}'
    },
    retry: {
        id: 'activity.deadLetters.retry',
        defaultMessage: 'Retry'
    },
    retryLabel: {
        id: 'activity.deadLetters.retryLabel',
        defaultMessage: 'Retry {kind} from {when}'
    },
    retrying: {
        id: 'activity.deadLetters.retrying',
        defaultMessage: 'Queueing {kind}…'
    },
    queued: {
        id: 'activity.deadLetters.queued',
        defaultMessage: 'Queued'
    },
    retryAll: {
        id: 'activity.deadLetters.retryAll',
        defaultMessage: 'Retry all'
    },
    retryAllLabel: {
        id: 'activity.deadLetters.retryAllLabel',
        defaultMessage:
            '{count, plural, one {Retry the # event shown} other {Retry all # events shown}}'
    },
    noError: {
        id: 'activity.deadLetters.noError',
        defaultMessage: 'No message was recorded'
    },
    showingOf: {
        id: 'activity.deadLetters.showingOf',
        defaultMessage:
            'Showing {count, plural, one {# event} other {# events}} of {total}.'
    },
    loading: {
        id: 'activity.deadLetters.loading',
        defaultMessage: 'Loading the parked events…'
    },
    loadError: {
        id: 'activity.deadLetters.loadError',
        defaultMessage: 'Couldn’t load the parked events. Please try again.'
    },
    reload: {
        id: 'activity.deadLetters.reload',
        defaultMessage: 'Try again'
    },
    close: {
        id: 'activity.deadLetters.close',
        defaultMessage: 'Close'
    }
});

/**
 * The parked events in full, and the operator actions that clear them.
 *
 * Each row says **what** could not be recorded (the same label the log uses —
 * "Changed role", not `member.role_changed`), **when** it happened, **how
 * often** it was tried and **why** it last failed: `lastError` is the single
 * field that tells an operator whether the cause is fixed, and it is arbitrary
 * server text, rendered as a text node, never as markup and never behind a
 * `title=`. A row that is retried stays, marked **Queued**, until the dialog
 * closes.
 *
 * **Retry all** retries the rows **shown here**, one at a time — never
 * "everything parked": the list is a capped page of an unbounded `total`, and
 * a bulk action must not reach rows the operator has never seen. The footer
 * says "Showing N of M" whenever the page is not the whole list.
 *
 * Unlike the banner, this surface renders its **error** state: somebody who
 * deliberately opened it asked a question, and an empty list would answer
 * "nothing is stuck", which is the opposite of what is known.
 */
export function DeadLettersDialog({
    open,
    onOpenChange,
    onCloseFocus,
    items,
    queuedIds,
    total,
    isPending,
    isError,
    onReload,
    retryingId,
    onRetry,
    retryingAll,
    onRetryAll
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Where focus goes on close. A **modal** Radix dialog only restores focus
     * through a `DialogTrigger`, and this one is opened from the banner's own
     * layout — and the banner may be gone by the time it closes.
     */
    onCloseFocus: () => void;
    /** The rows to list: the fetched page plus rows queued since. */
    items: DeadLetter[];
    /** Rows this reader queued while the dialog was open. */
    queuedIds: ReadonlyMap<string, unknown>;
    /** The unbounded count, so the title and footer never imply it away. */
    total: number;
    isPending: boolean;
    isError: boolean;
    /** Refetch, for the error branch's own retry. */
    onReload: () => void;
    /** The row currently being queued. */
    retryingId: string | null;
    onRetry: (id: string) => void;
    /** A "Retry all" pass is running. */
    retryingAll: boolean;
    onRetryAll: () => void;
}) {
    const intl = useIntl();

    /** The row's date, formatted once for the line and its button's name. */
    const whenOf = (item: DeadLetter) =>
        intl.formatDate(item.occurredAt, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    const pending = items.filter((item) => !queuedIds.has(item.id));
    const truncated = !isPending && !isError && items.length < total;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-lg sm:max-w-[600px]"
                closeLabel={intl.formatMessage(messages.close)}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    onCloseFocus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.dialogTitle, {
                            count: total
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.dialogDescription)}
                    </DialogDescription>
                </DialogHeader>

                {isPending ? (
                    <div className="flex items-center justify-center py-10">
                        <Spinner aria-hidden="true" />
                        <span className="sr-only">
                            {intl.formatMessage(messages.loading)}
                        </span>
                    </div>
                ) : isError ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>
                                {intl.formatMessage(messages.loadError)}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="shadow-none"
                                onClick={onReload}
                            >
                                {intl.formatMessage(messages.reload)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <ul
                        aria-label={intl.formatMessage(messages.listLabel)}
                        className="max-h-[60vh] divide-y overflow-auto rounded-lg border"
                    >
                        {items.map((item) => {
                            const label = formatActivityAction(
                                intl,
                                auditKindOf(item.kind)
                            );
                            const when = whenOf(item);
                            const busy = retryingId === item.id;
                            const isQueued = queuedIds.has(item.id);
                            return (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">
                                            {label}
                                        </p>
                                        <p className="break-words text-xs text-muted-foreground">
                                            {/* `activityDateTime` for the
                                                attribute and `formatDate` for
                                                the text: both are total, and an
                                                unparseable wire timestamp must
                                                not throw (`activity:I-25`). */}
                                            <time
                                                dateTime={activityDateTime(
                                                    item.occurredAt
                                                )}
                                            >
                                                {when}
                                            </time>
                                            {' · '}
                                            {intl.formatMessage(
                                                messages.attempts,
                                                { count: item.attempts }
                                            )}
                                            {' · '}
                                            <span className="text-destructive">
                                                {item.lastError ??
                                                    intl.formatMessage(
                                                        messages.noError
                                                    )}
                                            </span>
                                        </p>
                                    </div>
                                    {isQueued ? (
                                        <Badge
                                            variant="success"
                                            size="xs"
                                            className="shrink-0"
                                        >
                                            <Check
                                                aria-hidden
                                                className="size-3"
                                            />
                                            {intl.formatMessage(
                                                messages.queued
                                            )}
                                        </Badge>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0 shadow-none"
                                            // `aria-disabled`, not `disabled`:
                                            // a disabled button leaves the tab
                                            // order, so a keyboard user would
                                            // lose their place the moment it
                                            // went busy.
                                            aria-disabled={
                                                busy || retryingAll || undefined
                                            }
                                            aria-label={intl.formatMessage(
                                                messages.retryLabel,
                                                { kind: label, when }
                                            )}
                                            onClick={() => {
                                                if (busy || retryingAll) return;
                                                onRetry(item.id);
                                            }}
                                        >
                                            {busy ? (
                                                <>
                                                    <Spinner
                                                        aria-hidden="true"
                                                        className="size-4"
                                                    />
                                                    <span className="sr-only">
                                                        {intl.formatMessage(
                                                            messages.retrying,
                                                            { kind: label }
                                                        )}
                                                    </span>
                                                </>
                                            ) : null}
                                            {intl.formatMessage(messages.retry)}
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                <DialogFooter className="gap-2 sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        {!isPending && !isError && pending.length > 0 ? (
                            <Button
                                variant="outline"
                                className="shadow-none"
                                aria-disabled={retryingAll || undefined}
                                aria-label={intl.formatMessage(
                                    messages.retryAllLabel,
                                    { count: pending.length }
                                )}
                                onClick={() => {
                                    if (retryingAll) return;
                                    onRetryAll();
                                }}
                            >
                                {retryingAll ? (
                                    <Spinner
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                ) : (
                                    <RefreshCw aria-hidden="true" />
                                )}
                                {intl.formatMessage(messages.retryAll)}
                            </Button>
                        ) : null}
                        {truncated ? (
                            <span className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.showingOf, {
                                    count: items.length,
                                    total
                                })}
                            </span>
                        ) : null}
                    </div>
                    <Button onClick={() => onOpenChange(false)}>
                        {intl.formatMessage(messages.close)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
