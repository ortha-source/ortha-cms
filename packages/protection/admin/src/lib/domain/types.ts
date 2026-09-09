/**
 * What the entry editor knows about review — the wire shapes
 * `GET /api/protection/entries/:type/:id` returns, restated locally because the
 * admin cannot import the server package, plus the two derivations the screen
 * makes from them.
 *
 * **Nothing here counts anything.** The numbers arrive computed: the server
 * reads them from `evaluateProtection` in the kernel, so the panel drawing
 * "1 of 2" and the API refusing the publish are one implementation. A count
 * recomputed here would agree until somebody switched on `countStaleApprovals`,
 * and then quietly stop.
 */

/** One recorded vote, as the panel renders it. */
export type ReviewApproval = {
    /** Who voted. The panel resolves the name from the workspace's members. */
    userId: string;
    decision: 'approved' | 'changes_requested';
    /** Their reason, when they left one. */
    note: string | null;
    /** The revision they voted on. */
    revisionId: string;
    /** Its 1-based version number — what a struck-through line points at. */
    revisionNumber: number | null;
    /** Whether the vote sits off the head, and so no longer counts. */
    isStale: boolean;
    createdAt: string;
};

/** The open ask on an entry, when there is one. */
export type ReviewRequest = {
    id: string;
    requestedBy: string;
    note: string | null;
    revisionId: string;
    createdAt: string;
};

/** Everything the editor needs to render review, in one read. */
export type EntryReview = {
    /** Whether a rule is in force for this type. */
    protected: boolean;
    /** How many approvals the rule wants. `0` when unprotected. */
    required: number;
    /** How many count right now. */
    given: number;
    /** How many people's only approval sits on an earlier version. */
    stale: number;
    /** How many asked for changes on the head. Never lowers `given`. */
    changesRequested: number;
    /** Whether publication is held. Always `false` when unprotected. */
    blocked: boolean;
    /** Whether an administrator could publish past the rule. */
    bypassable: boolean;
    headRevisionId: string;
    headRevisionNumber: number;
    /** Whether the caller wrote the head, and so cannot approve it. */
    callerWroteHead: boolean;
    /** Every vote on the entry, stale ones included. */
    approvals: ReviewApproval[];
    /** The open ask, or `null`. */
    request: ReviewRequest | null;
};

/**
 * How far along the count is, as a name rather than a colour.
 *
 * The header action mirrors the publish gate's — destructive short of any
 * approval, warning part-way, success once satisfied — and this is where that
 * mapping lives so the chip beside the title and the rail's own heading cannot
 * drift apart. Every consumer pairs it with **text**: a reader who does not see
 * colour still reads "1 of 2".
 */
export type ReviewTone = 'blocked' | 'partial' | 'satisfied';

/** The tone for a review state. */
export function toneOf(review: EntryReview): ReviewTone {
    if (review.given >= review.required) return 'satisfied';
    return review.given === 0 ? 'blocked' : 'partial';
}

/**
 * Whether this person may cast a vote on the head revision.
 *
 * Two things withhold it, and they are different refusals: not holding
 * `content:approve` is a permission the operator can grant, while having
 * written the head is the four-eyes rule doing exactly its job. The caller
 * renders a different sentence for each, so both are reported rather than
 * folded into one boolean.
 */
export function approvalBlockedReason(
    review: EntryReview,
    canApprove: boolean
): 'no-permission' | 'wrote-head' | null {
    if (!canApprove) return 'no-permission';
    if (review.callerWroteHead) return 'wrote-head';
    return null;
}
