import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertTriangle } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { ApiError, HTTP_STATUS } from '@orthacms/utils-admin';
import {
    useDeadLetters,
    DIALOG_DEAD_LETTER_LIMIT,
    NOTICE_DEAD_LETTER_LIMIT
} from '../../../application/useDeadLetters';
import { useRetryDeadLetter } from '../../../application/useRetryDeadLetter';
import { useRetryAllDeadLetters } from '../../../application/useRetryAllDeadLetters';
import { useRefreshDeadLetters } from '../../../application/useRefreshDeadLetters';
import type { DeadLetter } from '../../../types/deadLetter';
import { DeadLettersDialog } from './DeadLettersDialog';

/** Intl descriptors for {@link DeadLetterNotice}, co-located here. */
const messages = defineMessages({
    title: {
        id: 'activity.deadLetters.title',
        defaultMessage:
            '{count, plural, one {# action was not recorded.} other {# actions were not recorded.}}'
    },
    body: {
        id: 'activity.deadLetters.body',
        defaultMessage: 'The log below is incomplete.'
    },
    review: {
        id: 'activity.deadLetters.review',
        defaultMessage: 'Review and retry'
    },
    retried: {
        id: 'activity.deadLetters.retried',
        // "Queued", never "recorded": the retry resets the attempt count and
        // the dispatcher decides seconds later whether it finally lands.
        defaultMessage: 'Queued to be tried again.'
    },
    allClear: {
        id: 'activity.deadLetters.allClear',
        defaultMessage: 'Queued the last one — nothing is parked now.'
    },
    retryGone: {
        id: 'activity.deadLetters.retryGone',
        defaultMessage: 'That event is no longer parked.'
    },
    retryFailed: {
        id: 'activity.deadLetters.retryFailed',
        defaultMessage: 'Couldn’t queue that event. Please try again.'
    },
    retriedAll: {
        id: 'activity.deadLetters.retriedAll',
        defaultMessage:
            '{count, plural, =0 {Nothing was queued.} one {Queued # event to be tried again.} other {Queued # events to be tried again.}}{gone, plural, =0 {} one { # was no longer parked.} other { # were no longer parked.}}'
    },
    retryAllStopped: {
        id: 'activity.deadLetters.retryAllStopped',
        defaultMessage:
            '{count, plural, =0 {Couldn’t queue the events.} one {Queued # event, then stopped.} other {Queued # events, then stopped.}} {skipped, plural, one {# was not queued.} other {# were not queued.}} Please try again.'
    }
});

/** The shell's `<main>`, already `tabIndex={-1}` for the skip link. */
const MAIN_CONTENT_ID = 'main-content';

/** Whether an error is the server saying "that row is not parked any more". */
function isGone(error: unknown): boolean {
    const status = error instanceof ApiError ? error.status : null;
    return status === HTTP_STATUS.NOT_FOUND || status === HTTP_STATUS.CONFLICT;
}

/**
 * Says, on the page whose whole job is being the record of record, that the
 * record has holes in it — "3 actions were not recorded. The log below is
 * incomplete." — and, for an operator who may act, opens the dialog that
 * closes them.
 *
 * **Renders nothing when there is nothing to say**, which is the normal case,
 * and nothing while loading or on error — a caveat about a list must never be
 * the reason the page looks broken. The dialog is the deliberate opposite: see
 * {@link DeadLettersDialog}.
 *
 * The banner renders for anyone with `activity:read`; the trigger is
 * **hidden**, not disabled, without `activity:manage` (`activity:I-28`).
 *
 * **The dialog outlives the banner.** A retried row stays in the dialog marked
 * "Queued" until the dialog closes — the operator sees what they did rather
 * than rows vanishing under the pointer — so retrying the last one empties the
 * banner while the dialog is still open. The dialog is therefore mounted
 * whenever it is open, banner or not, and on close focus goes back to the
 * trigger if it still exists and to `<main>` if it does not (WCAG 2.4.3):
 * Radix would otherwise restore focus to a button that is gone, and the next
 * Tab would restart at the top of the document.
 */
export function DeadLetterNotice() {
    const intl = useIntl();
    // `activity:I-28`: the enablement *is* the permission, stated here rather
    // than inherited from `ActivityLogPage`'s early return.
    const canRead = useHasPermission('activity:read');
    const canManage = useHasPermission('activity:manage');

    const [open, setOpen] = useState(false);
    // Rows this reader queued while the dialog was open, kept as they were so
    // they can say "Queued" after the refetch has taken them off the list.
    const [queued, setQueued] = useState<ReadonlyMap<string, DeadLetter>>(
        () => new Map()
    );
    // The row a "Retry all" pass is sending right now.
    const [sendingId, setSendingId] = useState<string | null>(null);
    // Handed to the dialog so it can put focus back where it came from; a
    // modal Radix dialog only does that through a `DialogTrigger`, and this
    // trigger lives in the banner's own layout.
    const triggerRef = useRef<HTMLButtonElement>(null);

    const { data } = useDeadLetters(NOTICE_DEAD_LETTER_LIMIT, canRead);
    // The dialog's larger page is a separate cache entry (the limit is part of
    // the key), and it is not fetched until the dialog is first opened.
    const dialog = useDeadLetters(
        DIALOG_DEAD_LETTER_LIMIT,
        canRead && canManage && open
    );
    const retry = useRetryDeadLetter();
    const retryAll = useRetryAllDeadLetters();
    const refreshDeadLetters = useRefreshDeadLetters();

    const total = data?.total ?? 0;
    const dialogTotal = dialog.data?.total ?? total;
    const fetched = dialog.data?.items ?? [];
    // What the dialog lists: the current page, plus anything this reader
    // queued that the refetch has since taken off it, newest first.
    const items = [
        ...fetched,
        ...[...queued.values()].filter(
            (row) => !fetched.some((item) => item.id === row.id)
        )
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || 0);
    const pendingIds = items
        .filter((item) => !queued.has(item.id))
        .map((item) => item.id);

    const markQueued = (ids: readonly string[]) => {
        setQueued((previous) => {
            const next = new Map(previous);
            for (const id of ids) {
                const row = items.find((item) => item.id === id);
                if (row) next.set(id, row);
            }
            return next;
        });
    };

    const onOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setQueued(new Map());
    };

    /**
     * Queue one parked event, and say what happened. No confirmation step:
     * `activity:I-03` makes the audit insert `ON CONFLICT DO NOTHING`, so
     * pressing this twice is pressing it once. The toast is the announcement.
     */
    const onRetry = (id: string) => {
        const wasLast = dialogTotal === 1;
        retry.mutate(
            { id },
            {
                onSuccess: () => {
                    markQueued([id]);
                    toast.success(
                        intl.formatMessage(
                            wasLast ? messages.allClear : messages.retried
                        )
                    );
                },
                onError: (error) => {
                    // 404 (unknown, or already delivered) and 409 (exists but
                    // has not given up yet) are one message: both mean the row
                    // is no longer parked, and the difference is not the
                    // reader's to act on. The list is refreshed — **both**
                    // cache entries — rather than left saying something untrue.
                    const gone = isGone(error);
                    toast.error(
                        intl.formatMessage(
                            gone ? messages.retryGone : messages.retryFailed
                        )
                    );
                    if (gone) refreshDeadLetters();
                }
            }
        );
    };

    /**
     * Retry every row the dialog is **showing**, one at a time, stopping at the
     * first failure that is not "already gone" — see `useRetryAllDeadLetters`.
     */
    const onRetryAll = () => {
        if (pendingIds.length === 0 || retryAll.isPending) return;
        retryAll.mutate(
            { ids: pendingIds, onEach: setSendingId },
            {
                onSuccess: (outcome) => {
                    markQueued(outcome.queued);
                    if (outcome.error) {
                        toast.error(
                            intl.formatMessage(messages.retryAllStopped, {
                                count: outcome.queued.length,
                                skipped: outcome.skipped.length + 1
                            })
                        );
                        return;
                    }
                    toast.success(
                        intl.formatMessage(messages.retriedAll, {
                            count: outcome.queued.length,
                            gone: outcome.gone.length
                        })
                    );
                },
                onSettled: () => setSendingId(null)
            }
        );
    };

    const showBanner = Boolean(data) && total > 0;
    if (!showBanner && !open) {
        return null;
    }

    return (
        <>
            {showBanner ? (
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle aria-hidden="true" className="size-4" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-0 flex-1">
                            <strong className="font-semibold">
                                {intl.formatMessage(messages.title, {
                                    count: total
                                })}
                            </strong>{' '}
                            {intl.formatMessage(messages.body)}
                        </span>
                        {canManage ? (
                            <Button
                                ref={triggerRef}
                                size="sm"
                                variant="outline"
                                className="shadow-none"
                                onClick={() => setOpen(true)}
                            >
                                {intl.formatMessage(messages.review)}
                            </Button>
                        ) : null}
                    </AlertDescription>
                </Alert>
            ) : null}

            {/* Outside the banner, not inside it: the `Alert` is a
                `role="alert"` live region, and a dialog's worth of rows
                mounting inside one would be announced wholesale. */}
            {canManage ? (
                <DeadLettersDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    onCloseFocus={() => {
                        const trigger = triggerRef.current;
                        if (trigger?.isConnected) {
                            trigger.focus();
                            return;
                        }
                        document.getElementById(MAIN_CONTENT_ID)?.focus();
                    }}
                    items={items}
                    queuedIds={queued}
                    total={dialogTotal}
                    isPending={dialog.isPending}
                    isError={dialog.isError}
                    // "Try again" is asking the list again, and there is one
                    // list behind the two cache entries: refreshing only the
                    // dialog's page would let it recover into a count the
                    // banner still contradicts.
                    onReload={refreshDeadLetters}
                    // Scoped to the pressed row through the mutation's own
                    // variables (or the row a "Retry all" pass is on), so one
                    // row's spinner does not freeze the others.
                    retryingId={
                        sendingId ??
                        (retry.isPending ? (retry.variables?.id ?? null) : null)
                    }
                    onRetry={onRetry}
                    retryingAll={retryAll.isPending}
                    onRetryAll={onRetryAll}
                />
            ) : null}
        </>
    );
}
