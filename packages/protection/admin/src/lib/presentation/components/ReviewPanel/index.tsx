import type { ReactNode, RefObject } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { ArrowRight, Check, Info } from 'lucide-react';
import {
    Button,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    Skeleton,
    SkeletonRegion,
    toast
} from '@orthacms/design-system';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import type { EntryReview } from '../../../domain/types';
import {
    useApproveFromQueue,
    useEntryReview,
    type EntryReviewScope
} from '../../../application/hooks';
import { ApprovalProgress } from '../ApprovalProgress';
import { useRecordName } from '../RecordSummary';
import { OverdueBadge, isOverdue } from '../RequestAge';
import { ReviewChanges } from '../ReviewChanges';
import { ReviewerLabel } from '../ReviewerLabel';

const messages = defineMessages({
    description: {
        id: 'protection.panel.description',
        defaultMessage: 'A record in {type}, and what changed in it.'
    },
    openRecord: {
        id: 'protection.panel.openRecord',
        defaultMessage: 'Open record'
    },
    close: { id: 'protection.panel.close', defaultMessage: 'Close' },
    asked: {
        id: 'protection.panel.asked',
        defaultMessage: '{requester} asked {reviewers} · {when}'
    },
    askedNobody: {
        id: 'protection.panel.askedNobody',
        defaultMessage: '{requester} asked for a review · {when}'
    },
    notAsked: {
        id: 'protection.panel.notAsked',
        defaultMessage: 'Nobody has asked for a review of this version.'
    },
    you: { id: 'protection.panel.you', defaultMessage: 'you' },
    formerMember: {
        id: 'protection.panel.formerMember',
        defaultMessage: 'a former member'
    },
    lastApproved: {
        id: 'protection.panel.lastApproved',
        defaultMessage: '{who} approved {when}'
    },
    youCap: { id: 'protection.panel.youCapital', defaultMessage: 'You' },
    changesKicker: {
        id: 'protection.panel.changesKicker',
        defaultMessage: 'Changes since it was last published'
    },
    neverPublishedKicker: {
        id: 'protection.panel.neverPublishedKicker',
        defaultMessage: 'Not published yet — everything in it is new'
    },
    lets: {
        id: 'protection.panel.lets',
        defaultMessage:
            '{remaining, plural, =0 {Approving lets {requester} publish.} one {Approving lets {requester} publish once one more approval is in.} other {Approving lets {requester} publish once # more approvals are in.}}'
    },
    letsNobody: {
        id: 'protection.panel.letsNobody',
        defaultMessage:
            '{remaining, plural, =0 {Approving is the last approval it needs.} one {After yours it needs one more approval.} other {After yours it needs # more approvals.}}'
    },
    asksAgain: {
        id: 'protection.panel.asksAgain',
        defaultMessage: 'A new save asks again.'
    },
    keeps: {
        id: 'protection.panel.keeps',
        defaultMessage: 'Approvals stay after a new save.'
    },
    unprotected: {
        id: 'protection.panel.unprotected',
        defaultMessage:
            'This type has no publishing rule, so approving records that you looked without holding anything back.'
    },
    approve: { id: 'protection.panel.approve', defaultMessage: 'Approve' },
    approving: {
        id: 'protection.panel.approving',
        defaultMessage: 'Approving…'
    },
    approved: {
        id: 'protection.panel.approved',
        defaultMessage: 'You approved this version'
    },
    approvedToast: {
        id: 'protection.panel.approvedToast',
        defaultMessage: 'Approved {entry}.'
    },
    approveFailed: {
        id: 'protection.panel.approveFailed',
        defaultMessage: 'The approval could not be saved. Try again.'
    },
    wroteHead: {
        id: 'protection.panel.wroteHead',
        defaultMessage:
            'You wrote this version, so somebody else has to approve it.'
    },
    noPermission: {
        id: 'protection.panel.noPermission',
        defaultMessage: 'Your role can’t approve records in this workspace.'
    },
    live: {
        id: 'protection.panel.live',
        defaultMessage:
            'This version is already live — there is nothing to approve.'
    },
    loading: {
        id: 'protection.panel.loading',
        defaultMessage: 'Loading the review'
    },
    failed: {
        id: 'protection.panel.failed',
        defaultMessage:
            'This review could not be loaded. Open the record to see where it stands.'
    }
});

/** What the panel needs of a queue line, whichever tab it came from. */
export type ReviewPanelItem = {
    /** The line's id — what the table draws as selected. */
    key: string;
    contentType: string;
    contentTypeLabel: string;
    entryId: string;
    entryTitle: string | null;
    /** When the open request was made, if there is one — for "Overdue". */
    askedAt: string | null;
    headRevisionNumber: number | null;
    liveRevisionNumber: number | null;
};

/** "5 days ago", "yesterday", "3 hours ago", "now" — for a sentence. */
function relativeAge(intl: IntlShape, iso: string, now = Date.now()) {
    const at = Date.parse(iso);
    if (Number.isNaN(at)) return '';
    const minutes = Math.max(0, Math.floor((now - at) / 60_000));
    if (minutes >= 60 * 24) {
        return intl.formatRelativeTime(
            -Math.floor(minutes / (60 * 24)),
            'day',
            { numeric: 'auto' }
        );
    }
    if (minutes >= 60) {
        return intl.formatRelativeTime(-Math.floor(minutes / 60), 'hour');
    }
    return intl.formatRelativeTime(-minutes, 'minute', { numeric: 'auto' });
}

/**
 * **Review and approve without leaving the queue.** Review on a row opens this
 * beside the table: who asked whom and when, how far the approvals have got
 * and who gave the last one, the changes since the live version, and
 * **Approve**. **Open record** is there for a closer look.
 *
 * Every number comes from the entry's own review read (`useEntryReview`) — the
 * one the editor's rail and the publish button obey — not from the queue line,
 * which is a hint: the panel is where somebody decides, so it shows what the
 * decision will meet. Approve is offered exactly when the rail would offer it:
 * not on a live version (I-25), not to the version's author (four eyes), not
 * twice, and not without `content:approve` — each of those said in words
 * instead of a missing button.
 *
 * It is a **non-modal** sheet: the queue stays readable and clickable beside
 * it, so Review on another row switches the panel rather than closing it.
 * Escape and Close dismiss it and put focus back on the row's Review button.
 */
export function ReviewPanel({
    item,
    overdueAfterDays,
    onOpenChange,
    returnFocusTo
}: {
    /** The line under review; `null` closes the panel. */
    item: ReviewPanelItem | null;
    /** The server's overdue cut. */
    overdueAfterDays: number;
    onOpenChange: (open: boolean) => void;
    /** The Review button that opened it, for focus return. */
    returnFocusTo?: RefObject<HTMLElement | null>;
}) {
    const intl = useIntl();
    const name = useRecordName();

    return (
        <Sheet open={!!item} onOpenChange={onOpenChange} modal={false}>
            <SheetContent
                side="right"
                closeLabel={intl.formatMessage(messages.close)}
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]"
                // The queue stays usable beside the panel: a click on another
                // row's Review switches what it shows rather than dismissing it.
                onInteractOutside={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => {
                    const target = returnFocusTo?.current;
                    if (target?.isConnected) {
                        event.preventDefault();
                        target.focus();
                    }
                }}
            >
                {item ? (
                    <>
                        <div className="flex items-center gap-2 border-b py-3.5 pl-4 pr-12">
                            <SheetTitle className="truncate text-sm font-semibold">
                                {name(item)}
                            </SheetTitle>
                            {item.askedAt &&
                            isOverdue(item.askedAt, overdueAfterDays) ? (
                                <OverdueBadge />
                            ) : null}
                            <span className="flex-1" />
                            <Button asChild variant="ghost" size="sm">
                                <Link
                                    to={`../content/${item.contentType}/${item.entryId}`}
                                >
                                    <ArrowRight aria-hidden />
                                    {intl.formatMessage(messages.openRecord)}
                                </Link>
                            </Button>
                        </div>
                        <SheetDescription className="sr-only">
                            {intl.formatMessage(messages.description, {
                                type: item.contentTypeLabel
                            })}
                        </SheetDescription>
                        {/* Keyed by the line, so switching rows starts the
                            body afresh rather than flashing the last one. */}
                        <PanelBody key={item.key} item={item} />
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

/** Everything under the header, for one line. */
function PanelBody({ item }: { item: ReviewPanelItem }) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const scope: EntryReviewScope = {
        workspaceId: workspace.id,
        typeName: item.contentType,
        entryId: item.entryId,
        // The version component of the review key. The queue does not know
        // the entry's `updatedAt`; the head's number is the same fact — a save
        // moves both — and the prefix an approval invalidates is unchanged.
        updatedAt: `rev-${item.headRevisionNumber ?? 0}`
    };
    const review = useEntryReview(scope);

    if (review.isPending) {
        return (
            <div className="flex-1 px-4 py-4">
                <SkeletonRegion label={intl.formatMessage(messages.loading)}>
                    <Skeleton className="h-5 w-72" />
                    <Skeleton className="mt-3 h-4 w-40" />
                    <Skeleton className="mt-6 h-32 w-full" />
                </SkeletonRegion>
            </div>
        );
    }
    if (review.isError || !review.data) {
        return (
            <p role="alert" className="px-4 py-4 text-sm text-destructive">
                {intl.formatMessage(messages.failed)}
            </p>
        );
    }

    return <PanelLoaded item={item} scope={scope} review={review.data} />;
}

function PanelLoaded({
    item,
    scope,
    review
}: {
    item: ReviewPanelItem;
    scope: EntryReviewScope;
    review: EntryReview;
}) {
    const intl = useIntl();
    const auth = useAuth();
    const workspace = useCurrentWorkspace();
    const canApprove = useHasPermission('content:approve');
    const approve = useApproveFromQueue(scope);
    const recordName = useRecordName();
    const me = auth.user?.id;

    const member = (id: string) =>
        workspace.members.find((entry) => entry.id === id);
    /** A person as a sentence names them: "you", or their full name. */
    const named = (id: string) =>
        id === me
            ? intl.formatMessage(messages.you)
            : (member(id)?.name ?? intl.formatMessage(messages.formerMember));
    const firstName = (id: string) => {
        const full = member(id)?.name;
        return full ? (full.split(/\s+/)[0] ?? full) : named(id);
    };

    const request = review.request;
    const headNumber = review.headRevisionNumber ?? item.headRevisionNumber;

    // Who gave the newest approval that still counts — "Ada approved
    // yesterday" — which is the explanation the pips alone do not give.
    const latest = review.approvals
        .filter((vote) => !vote.isStale)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

    const remaining = Math.max(0, review.required - review.given - 1);
    const canVote =
        canApprove &&
        !review.headPublished &&
        !review.callerWroteHead &&
        !review.callerApprovedHead;

    const callout = !review.protected
        ? intl.formatMessage(messages.unprotected)
        : [
              request && request.requestedBy !== me
                  ? intl.formatMessage(messages.lets, {
                        remaining,
                        requester: firstName(request.requestedBy)
                    })
                  : intl.formatMessage(messages.letsNobody, { remaining }),
              intl.formatMessage(
                  review.countsStaleApprovals
                      ? messages.keeps
                      : messages.asksAgain
              )
          ].join(' ');

    const submit = () =>
        approve.mutate(
            { typeName: scope.typeName, entryId: scope.entryId },
            {
                onSuccess: () =>
                    toast.success(
                        intl.formatMessage(messages.approvedToast, {
                            entry: recordName(item)
                        })
                    ),
                onError: () =>
                    toast.error(intl.formatMessage(messages.approveFailed))
            }
        );

    let footer: ReactNode = null;
    if (review.headPublished) {
        footer = intl.formatMessage(messages.live);
    } else if (review.callerApprovedHead) {
        footer = (
            <span className="inline-flex items-center gap-1.5 text-success-soft-foreground">
                <Check aria-hidden className="size-4" />
                {intl.formatMessage(messages.approved)}
            </span>
        );
    } else if (!canApprove) {
        footer = intl.formatMessage(messages.noPermission);
    } else if (review.callerWroteHead) {
        footer = intl.formatMessage(messages.wroteHead);
    }

    return (
        <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                {request ? (
                    <div className="flex items-center gap-2 text-[13px]">
                        <span className="shrink-0" aria-hidden>
                            <ReviewerLabel
                                userId={request.requestedBy}
                                currentUserId={me}
                                compact
                            />
                        </span>
                        <span>
                            {intl.formatMessage(
                                request.reviewerIds.length
                                    ? messages.asked
                                    : messages.askedNobody,
                                {
                                    requester: (
                                        <b key="r" className="font-medium">
                                            {request.requestedBy === me
                                                ? intl.formatMessage(
                                                      messages.youCap
                                                  )
                                                : named(request.requestedBy)}
                                        </b>
                                    ),
                                    reviewers: intl.formatList(
                                        request.reviewerIds.map(named),
                                        { type: 'conjunction' }
                                    ),
                                    when: relativeAge(intl, request.createdAt)
                                }
                            )}
                        </span>
                    </div>
                ) : (
                    <p className="text-[13px] text-muted-foreground">
                        {intl.formatMessage(messages.notAsked)}
                    </p>
                )}

                {review.protected ? (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <ApprovalProgress
                            given={review.given}
                            required={review.required}
                        />
                        {latest ? (
                            <span className="text-[13px] text-muted-foreground">
                                {intl.formatMessage(messages.lastApproved, {
                                    who:
                                        latest.userId === me
                                            ? intl.formatMessage(
                                                  messages.youCap
                                              )
                                            : firstName(latest.userId),
                                    when: relativeAge(intl, latest.createdAt)
                                })}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                <section
                    aria-labelledby={`changes-${item.key}`}
                    className="flex flex-col gap-2"
                >
                    <h3
                        id={`changes-${item.key}`}
                        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                        {intl.formatMessage(
                            item.liveRevisionNumber == null &&
                                !review.headPublished
                                ? messages.neverPublishedKicker
                                : messages.changesKicker
                        )}
                    </h3>
                    <ReviewChanges
                        typeName={item.contentType}
                        entryId={item.entryId}
                        headNumber={headNumber}
                        liveNumber={
                            review.headPublished
                                ? headNumber
                                : item.liveRevisionNumber
                        }
                    />
                </section>

                {!review.headPublished ? (
                    <div className="flex gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-3 text-[13px] text-muted-foreground">
                        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <p>{callout}</p>
                    </div>
                ) : null}
            </div>
            <div className="flex items-center gap-2 border-t px-4 py-3">
                <p className="flex-1 text-[13px] text-muted-foreground">
                    {footer}
                </p>
                {canVote ? (
                    <Button
                        type="button"
                        disabled={approve.isPending}
                        onClick={submit}
                    >
                        <Check aria-hidden />
                        {intl.formatMessage(
                            approve.isPending
                                ? messages.approving
                                : messages.approve
                        )}
                    </Button>
                ) : null}
            </div>
        </>
    );
}
