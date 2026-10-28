import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    NOTIFICATION_DISPATCHER,
    NOTIFICATION_KINDS,
    type NotificationDispatcher
} from '@orthacms/mail-domain';
import {
    INBOX_KINDS,
    INBOX_WRITER,
    type InboxDelivery,
    type InboxEntryRef,
    type InboxWriter
} from '@orthacms/inbox-domain';
import {
    ReviewNoticeQuery,
    type NoticePerson
} from '../infrastructure/review-notice.query';

/** The record a notice is about. */
interface ReviewedEntry {
    workspaceId: string;
    contentType: string;
    entryId: string;
}

/** A review request, as the notices about it need it. */
export interface RequestedReview extends ReviewedEntry {
    requestId: string;
    /** The head the request was opened on — part of the inbox item's identity. */
    revisionId: string;
    requesterId: string;
    /** Everybody the request names now, in pick order. */
    reviewerIds: readonly string[];
    /** The ones this write added — the only ones told about it. */
    newReviewerIds: readonly string[];
    /** The type's rule's count; `0` when nobody protected it. */
    requiredApprovals: number;
}

/** An approval that completed the count on the head. */
export interface ReadyReview extends ReviewedEntry {
    requesterId: string;
    revisionId: string;
    requiredApprovals: number;
}

/** Approvals a save just left behind. */
export interface StaleApprovals extends ReviewedEntry {
    /** Who approved the version the save replaced. */
    userIds: readonly string[];
    /** That version's number. */
    approvedRevisionNumber: number;
    /** The new head — part of each item's identity. */
    headRevisionId: string;
}

/** A person as a sentence names them: their name, else their address. */
function nameOf(person: NoticePerson | undefined): string | null {
    if (!person) return null;
    return person.name?.trim() || person.email;
}

/** The Reviews page — where every one of these notices leads. */
function reviewsPath(workspaceId: string): string {
    return `workspaces/${workspaceId}/reviews`;
}

/** The record's editor, for news about one record. */
function entryPath(entry: ReviewedEntry): string {
    return `workspaces/${entry.workspaceId}/content/${entry.contentType}/${entry.entryId}`;
}

/**
 * Tells people about review work that concerns them — by mail when the
 * deployment has a provider, in their inbox when the inbox plugin is
 * registered, through neither when it has neither (ADR-0023). Both ports are
 * optional, so protection behaves exactly as before without them.
 *
 * Three moments, and only three:
 *
 * - **A request names you** — mail and inbox, to the reviewers the write
 *   **adds**. A request is replaced whole when its reviewers change, and
 *   telling everybody again would turn "add Grace" into a second message to
 *   everyone else.
 * - **Your request has every approval it needs** — inbox only, to the
 *   requester, once per head.
 * - **A save left your approval behind** — inbox only, to the people whose
 *   approval stopped counting.
 *
 * The mail is written in the caller's transaction (the dispatcher refuses
 * otherwise), so a request that rolled back tells nobody; the inbox joins it
 * when there is one, and is idempotent by `dedupeKey` when there is not.
 */
@Injectable()
export class ReviewNotifier {
    constructor(
        private readonly notices: ReviewNoticeQuery,
        @Optional()
        @Inject(NOTIFICATION_DISPATCHER)
        private readonly mail?: NotificationDispatcher,
        @Optional()
        @Inject(INBOX_WRITER)
        private readonly inbox?: InboxWriter
    ) {}

    /** Whether anybody would hear anything. */
    private get silent(): boolean {
        return !this.mail && !this.inbox;
    }

    private async entryRef(
        entry: ReviewedEntry
    ): Promise<{ ref: InboxEntryRef; workspaceName: string }> {
        const subject = await this.notices.subject(
            entry.workspaceId,
            entry.contentType,
            entry.entryId
        );
        return {
            ref: {
                contentType: entry.contentType,
                contentTypeLabel: subject.contentTypeLabel,
                entryId: entry.entryId,
                entryTitle: subject.entryTitle
            },
            workspaceName: subject.workspaceName
        };
    }

    async reviewRequested(review: RequestedReview): Promise<void> {
        if (this.silent || !review.newReviewerIds.length) return;

        const [people, { ref: entry, workspaceName }] = await Promise.all([
            this.notices.people([review.requesterId, ...review.reviewerIds]),
            this.entryRef(review)
        ]);
        const requesterName =
            nameOf(people.get(review.requesterId)) ?? 'Somebody';

        const items: InboxDelivery[] = [];
        for (const reviewerId of review.newReviewerIds) {
            const reviewer = people.get(reviewerId);
            if (!reviewer) continue;
            items.push({
                kind: INBOX_KINDS.REVIEW_REQUESTED,
                userId: reviewerId,
                workspaceId: review.workspaceId,
                payload: {
                    ...entry,
                    requesterName,
                    required: review.requiredApprovals
                },
                link: reviewsPath(review.workspaceId),
                dedupeKey: `review.requested:${review.requestId}:${review.revisionId}`
            });
            await this.mail?.notify({
                kind: NOTIFICATION_KINDS.REVIEW_REQUESTED,
                to: reviewer.email,
                userId: reviewerId,
                recipientName: reviewer.name,
                requesterName,
                entryTitle: entry.entryTitle,
                contentTypeLabel: entry.contentTypeLabel,
                workspaceName,
                requiredApprovals: review.requiredApprovals,
                alsoAsked: review.reviewerIds
                    .filter((id) => id !== reviewerId)
                    .map((id) => nameOf(people.get(id)))
                    .filter((name): name is string => name !== null),
                reviewPath: reviewsPath(review.workspaceId)
            });
        }
        await this.inbox?.deliver(items);
    }

    async reviewReady(review: ReadyReview): Promise<void> {
        if (!this.inbox) return;
        const { ref: entry } = await this.entryRef(review);
        await this.inbox.deliver([
            {
                kind: INBOX_KINDS.REVIEW_READY,
                userId: review.requesterId,
                workspaceId: review.workspaceId,
                payload: { ...entry, required: review.requiredApprovals },
                link: entryPath(review),
                dedupeKey: `review.ready:${review.entryId}:${review.revisionId}`
            }
        ]);
    }

    async approvalsStale(stale: StaleApprovals): Promise<void> {
        if (!this.inbox || !stale.userIds.length) return;
        const { ref: entry } = await this.entryRef(stale);
        await this.inbox.deliver(
            stale.userIds.map((userId) => ({
                kind: INBOX_KINDS.REVIEW_APPROVAL_STALE,
                userId,
                workspaceId: stale.workspaceId,
                payload: {
                    ...entry,
                    approvedRevisionNumber: stale.approvedRevisionNumber
                },
                link: reviewsPath(stale.workspaceId),
                dedupeKey: `review.approval_stale:${stale.entryId}:${stale.headRevisionId}`
            }))
        );
    }
}
