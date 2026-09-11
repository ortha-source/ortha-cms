import type { EntryReview } from './types';

/** One person in the Review block. */
export type ReviewerRowView = {
    userId: string;
    /**
     * `approved` when they approved the current version, `pending` otherwise —
     * asked and not yet looked, or approved a version the entry has moved past.
     */
    state: 'approved' | 'pending';
    /** Whether the open request names them. */
    requested: boolean;
    /**
     * The version of their latest approval that no longer counts, when a save
     * left it behind; `null` when that version's number is unknown; absent when
     * they have no such approval. What turns "pending" into an explanation.
     */
    staleVersion?: number | null;
};

/**
 * The people the Review block lists: everybody asked, in the order they were
 * picked, then everybody else who approved some version of the entry.
 *
 * Nothing is counted here — the heading's "1 of 2" is the server's. This only
 * decides, per person, which of two marks to draw, from facts the server
 * reports: whether one of their approvals sits on the head.
 *
 * Somebody who approved without being asked is still listed. Who was asked
 * never changes whose approval counts, and leaving them out would make the
 * count disagree with the names beside it.
 */
export function reviewerRows(review: EntryReview): ReviewerRowView[] {
    const requested = review.request?.reviewerIds ?? [];
    const order = [...requested];
    for (const approval of review.approvals) {
        if (!order.includes(approval.userId)) order.push(approval.userId);
    }

    return order.map((userId) => {
        const theirs = review.approvals.filter(
            (approval) => approval.userId === userId
        );
        const row: ReviewerRowView = {
            userId,
            state: theirs.some((approval) => !approval.isStale)
                ? 'approved'
                : 'pending',
            requested: requested.includes(userId)
        };
        if (row.state === 'pending') {
            const latestStale = theirs
                .filter((approval) => approval.isStale)
                .sort(
                    (a, b) =>
                        (b.revisionNumber ?? -1) - (a.revisionNumber ?? -1)
                )[0];
            if (latestStale) row.staleVersion = latestStale.revisionNumber;
        }
        return row;
    });
}
