import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, MessageSquarePlus, Send } from 'lucide-react';
import { Button, Textarea, toast } from '@orthacms/design-system';
import type { EntryReview } from '../../../../domain/types';
import {
    useApprove,
    useRequestChanges,
    useRequestReview,
    type EntryReviewScope
} from '../../../../application/hooks';

const messages = defineMessages({
    requestReview: {
        id: 'protection.actions.requestReview',
        defaultMessage: 'Request review'
    },
    requestedToast: {
        id: 'protection.actions.requestedToast',
        defaultMessage: 'Review requested.'
    },
    approve: { id: 'protection.actions.approve', defaultMessage: 'Approve' },
    approvedToast: {
        id: 'protection.actions.approvedToast',
        defaultMessage: 'Approved — {given} of {required} on this version.'
    },
    requestChanges: {
        id: 'protection.actions.requestChanges',
        defaultMessage: 'Request changes'
    },
    changesToast: {
        id: 'protection.actions.changesToast',
        defaultMessage: 'Changes requested.'
    },
    noteLabel: {
        id: 'protection.actions.noteLabel',
        defaultMessage: 'Note (optional)'
    },
    notePlaceholder: {
        id: 'protection.actions.notePlaceholder',
        defaultMessage: 'What should be looked at?'
    },
    wroteHead: {
        id: 'protection.actions.wroteHead',
        defaultMessage:
            'You wrote this version, so somebody else has to approve it.'
    },
    failed: {
        id: 'protection.actions.failed',
        defaultMessage: 'That did not go through. Try again.'
    }
});

/**
 * The controls under the review list.
 *
 * Who is offered what is the four-eyes rule made visible. The person who wrote
 * the head revision is told **in a sentence** why they cannot approve it — not
 * shown a disabled button, which explains nothing to anybody and nothing at all
 * to a screen reader. Anybody else holding `content:approve` gets the vote.
 *
 * Every outcome is announced through `toast`, because approving moves a number
 * in a panel the person may not be looking at and nothing else on the screen
 * jumps.
 */
export function ReviewActions({
    scope,
    review,
    canApprove
}: {
    scope: EntryReviewScope;
    review: EntryReview;
    /** Whether the signed-in person holds `content:approve`. */
    canApprove: boolean;
}) {
    const intl = useIntl();
    const [note, setNote] = useState('');
    const requestReview = useRequestReview(scope);
    const approve = useApprove(scope);
    const requestChanges = useRequestChanges(scope);

    const ref = { typeName: scope.typeName, entryId: scope.entryId };
    const trimmed = () => note.trim() || undefined;
    const busy =
        requestReview.isPending ||
        approve.isPending ||
        requestChanges.isPending;

    /** Nobody has asked yet, so asking is the useful thing to offer. */
    const canAsk = !review.request;
    /** The vote, withheld from the head's own author whatever else they hold. */
    const canVote = canApprove && !review.callerWroteHead;

    if (!canAsk && !canVote) {
        return review.callerWroteHead ? (
            <p className="text-xs text-muted-foreground">
                {intl.formatMessage(messages.wroteHead)}
            </p>
        ) : null;
    }

    const failed = () => toast.error(intl.formatMessage(messages.failed));
    const done = (message: string) => () => {
        setNote('');
        toast.success(message);
    };

    return (
        <div className="flex flex-col gap-2">
            {review.callerWroteHead && canApprove ? (
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.wroteHead)}
                </p>
            ) : null}

            <Textarea
                aria-label={intl.formatMessage(messages.noteLabel)}
                placeholder={intl.formatMessage(messages.notePlaceholder)}
                value={note}
                rows={2}
                onChange={(event) => setNote(event.target.value)}
            />

            <div className="flex flex-wrap gap-2">
                {canVote ? (
                    <>
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                                approve.mutate(
                                    { ...ref, note: trimmed() },
                                    {
                                        onSuccess: done(
                                            intl.formatMessage(
                                                messages.approvedToast,
                                                {
                                                    given: review.given + 1,
                                                    required: review.required
                                                }
                                            )
                                        ),
                                        onError: failed
                                    }
                                )
                            }
                        >
                            <Check aria-hidden />
                            {intl.formatMessage(messages.approve)}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                                requestChanges.mutate(
                                    { ...ref, note: trimmed() },
                                    {
                                        onSuccess: done(
                                            intl.formatMessage(
                                                messages.changesToast
                                            )
                                        ),
                                        onError: failed
                                    }
                                )
                            }
                        >
                            <MessageSquarePlus aria-hidden />
                            {intl.formatMessage(messages.requestChanges)}
                        </Button>
                    </>
                ) : null}

                {canAsk ? (
                    <Button
                        type="button"
                        size="sm"
                        variant={canVote ? 'outline' : 'default'}
                        disabled={busy}
                        onClick={() =>
                            requestReview.mutate(
                                { ...ref, note: trimmed() },
                                {
                                    onSuccess: done(
                                        intl.formatMessage(
                                            messages.requestedToast
                                        )
                                    ),
                                    onError: failed
                                }
                            )
                        }
                    >
                        <Send aria-hidden />
                        {intl.formatMessage(messages.requestReview)}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
