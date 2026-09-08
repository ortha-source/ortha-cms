import type { ProtectionRule } from '@orthacms/protection-domain';

/**
 * One rule as the settings tab reads it.
 *
 * It is the domain's {@link ProtectionRule} — the six fields the decision is
 * made from — plus the addressing and the audit trail the screen shows around
 * it. Spelling the six out again here would be a second definition to keep in
 * step with the kernel, and the kernel is the one the publish gate consults.
 */
export interface ProtectionRuleView extends ProtectionRule {
    /** Row id. Stable across edits; the address is `(kind, slug)`. */
    id: string;
    /** `collection` or `single`. */
    kind: string;
    /** The code-defined content type name. */
    slug: string;
    /** Who last changed the rule, or `null` when that user is gone. */
    updatedBy: string | null;
    /** ISO-8601. */
    createdAt: string;
    /** ISO-8601. */
    updatedAt: string;
}

/** One recorded vote, as the entry panel renders it. */
export interface ReviewApprovalView {
    /** Who voted. The panel resolves the name; the API stays id-only. */
    userId: string;
    /** `approved` or `changes_requested`. */
    decision: string;
    /** Their reason, when they left one. */
    note: string | null;
    /** The revision they voted on. */
    revisionId: string;
    /**
     * Its 1-based version number — what the panel prints beside a struck-through
     * name. Without it "this no longer counts" has nothing to point at.
     */
    revisionNumber: number | null;
    /**
     * Whether the vote is off the head, and therefore struck through.
     *
     * A stale vote is still **shown**: a counter that silently rolls back after
     * a save is unexplainable to the person who just pressed Save, and the
     * struck-through line naming its version is the explanation.
     */
    isStale: boolean;
    /** ISO-8601. */
    createdAt: string;
}

/** The open ask on an entry, when there is one. */
export interface ReviewRequestView {
    id: string;
    requestedBy: string;
    note: string | null;
    /** The head at the moment of asking — trail only; the ask outlives it. */
    revisionId: string;
    /** ISO-8601. */
    createdAt: string;
}

/**
 * Everything the entry editor needs to render review, in one read.
 *
 * It is `evaluateProtection`'s decision plus the people behind the numbers. The
 * counts come from the kernel rather than from a second count in SQL — a number
 * computed twice is a button that disagrees with the API refusing it.
 */
export interface EntryReviewView {
    /** Whether a rule is in force for this type. */
    protected: boolean;
    /** How many approvals the rule wants. `0` when unprotected. */
    required: number;
    /** How many count right now. */
    given: number;
    /** How many people's only approval sits on an earlier version. */
    stale: number;
    /** How many people asked for changes on the head. Never lowers `given`. */
    changesRequested: number;
    /** Whether publication is currently held. Always `false` when unprotected. */
    blocked: boolean;
    /**
     * Whether an administrator could publish past the rule.
     *
     * Reported, never applied: taking a bypass costs a mandatory reason, which
     * only the publish route can demand. It is `false` for everybody but an
     * administrator, and for every rule with `adminBypass` off.
     */
    bypassable: boolean;
    /** The entry's current version — what an approval would be bound to. */
    headRevisionId: string;
    /** Its 1-based number. */
    headRevisionNumber: number;
    /** Whether the caller wrote the head, and so cannot approve it. */
    callerWroteHead: boolean;
    /** Every vote on the entry, stale ones included. */
    approvals: ReviewApprovalView[];
    /** The open ask, or `null`. */
    request: ReviewRequestView | null;
}

/** One line of the reviewer queue. */
export interface ReviewQueueItemView {
    id: string;
    contentType: string;
    entryId: string;
    requestedBy: string;
    note: string | null;
    /** How many approvals the type's rule wants; `0` when unprotected. */
    required: number;
    /** Distinct approvals on the entry's current head. */
    given: number;
    /** ISO-8601 — the age the page sorts and colours by. */
    createdAt: string;
}

/** A page of the reviewer queue. */
export interface ReviewQueueView {
    items: ReviewQueueItemView[];
    total: number;
}
