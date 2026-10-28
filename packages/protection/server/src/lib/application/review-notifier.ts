import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    NOTIFICATION_DISPATCHER,
    NOTIFICATION_KINDS,
    type NotificationDispatcher
} from '@orthacms/mail-domain';
import {
    ReviewNoticeQuery,
    type NoticePerson
} from '../infrastructure/review-notice.query';

/** A review request, as the notices about it need it. */
export interface RequestedReview {
    workspaceId: string;
    contentType: string;
    entryId: string;
    requesterId: string;
    /** Everybody the request names now, in pick order. */
    reviewerIds: readonly string[];
    /** The ones this write added — the only ones told about it. */
    newReviewerIds: readonly string[];
    /** The type's rule's count; `0` when nobody protected it. */
    requiredApprovals: number;
}

/** A person as a sentence names them: their name, else their address. */
function nameOf(person: NoticePerson | undefined): string | null {
    if (!person) return null;
    return person.name?.trim() || person.email;
}

/**
 * Tells the people a review request names that they were asked.
 *
 * **Only the newly asked.** A request is replaced whole when somebody changes
 * its reviewers, and mailing everybody on it again would turn "add Grace" into
 * a second message to everyone else. Approvals, saves and the reopen after a
 * publish send nothing: the Reviews page and its navigation count carry the
 * rest, and a message per save would be noise people learn to filter.
 *
 * Called **inside** the request's transaction, so a request that rolls back
 * tells nobody, and with the mail plugin absent (no provider configured) the
 * dispatcher is unbound and this is a no-op — the queue is then, as before,
 * how a reviewer finds out.
 */
@Injectable()
export class ReviewNotifier {
    constructor(
        private readonly notices: ReviewNoticeQuery,
        @Optional()
        @Inject(NOTIFICATION_DISPATCHER)
        private readonly mail?: NotificationDispatcher
    ) {}

    async reviewRequested(review: RequestedReview): Promise<void> {
        if (!this.mail || !review.newReviewerIds.length) return;

        const [people, subject] = await Promise.all([
            this.notices.people([review.requesterId, ...review.reviewerIds]),
            this.notices.subject(
                review.workspaceId,
                review.contentType,
                review.entryId
            )
        ]);
        const requesterName =
            nameOf(people.get(review.requesterId)) ?? 'Somebody';

        for (const reviewerId of review.newReviewerIds) {
            const reviewer = people.get(reviewerId);
            if (!reviewer) continue;
            await this.mail.notify({
                kind: NOTIFICATION_KINDS.REVIEW_REQUESTED,
                to: reviewer.email,
                userId: reviewerId,
                recipientName: reviewer.name,
                requesterName,
                entryTitle: subject.entryTitle,
                contentTypeLabel: subject.contentTypeLabel,
                workspaceName: subject.workspaceName,
                requiredApprovals: review.requiredApprovals,
                alsoAsked: review.reviewerIds
                    .filter((id) => id !== reviewerId)
                    .map((id) => nameOf(people.get(id)))
                    .filter((name): name is string => name !== null),
                reviewPath: `workspaces/${review.workspaceId}/reviews`
            });
        }
    }
}
