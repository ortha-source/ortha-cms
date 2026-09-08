/**
 * The values a protection decision is made from: the rule an administrator set
 * on a content type, the votes recorded against the entry's revisions, and who
 * is asking to publish.
 *
 * All framework-free, and deliberately narrow. Nothing here describes the
 * entry's *content* — protection authorizes, it never validates, and the
 * publish gate keeps sole ownership of "is this entry complete"
 * (ADR-0015). A field value cannot reach this decision because there is
 * nowhere in the input to put one.
 */

/** How a reviewer voted on one revision. */
export const APPROVAL_DECISION = {
    Approved: 'approved',
    ChangesRequested: 'changes_requested'
} as const;

/** A reviewer's vote. The runtime object above is the source of truth. */
export type ApprovalDecision =
    (typeof APPROVAL_DECISION)[keyof typeof APPROVAL_DECISION];

/**
 * The rule on one `(workspace, content type)` pair.
 *
 * Six fields and no condition: there is no filter and no per-entry exception,
 * because "why is this entry blocked and its neighbour not" must answer in one
 * word, and the word is the type.
 */
export interface ProtectionRule {
    /**
     * Off means the type behaves exactly as it does with no rule row at all —
     * a token included. A switched-off rule protects nothing.
     */
    readonly enabled: boolean;
    /** How many approvals on the head revision unlock publication. */
    readonly requiredApprovals: number;
    /** The four-eyes switch: the head revision's author cannot approve it. */
    readonly requireOtherPerson: boolean;
    /**
     * When on, approvals given on earlier revisions still count. Offered
     * because someone will ask; the editor labels it as not recommended.
     */
    readonly countStaleApprovals: boolean;
    /**
     * An administrator may publish past the rule, with a mandatory reason.
     * Off makes the rule absolute, administrators included.
     */
    readonly adminBypass: boolean;
    /** Off means a bearer token cannot publish this type at all. */
    readonly allowTokenPublish: boolean;
}

/**
 * One vote, on one version.
 *
 * `revisionId` is what makes an approval expire: a save writes a new revision,
 * so a vote recorded against the previous one stops counting toward the head
 * with no dismissal logic anywhere. Nothing is deleted — the row survives, and
 * the interface strikes it through naming the version it was given on, because
 * a counter that silently rolls back is unexplainable to the person who just
 * pressed Save.
 */
export interface Approval {
    /** The revision this vote was cast against. */
    readonly revisionId: string;
    /** Who cast it. One vote per person per revision. */
    readonly userId: string;
    readonly decision: ApprovalDecision;
}

/** Who is asking to publish. */
export interface ProtectionActor {
    /**
     * The acting user, or `null` for a bearer token — which is the point: a
     * token names nobody, so it can neither be excluded as an author nor
     * written into a bypass log row.
     */
    readonly userId: string | null;
    readonly isAdmin: boolean;
    readonly isToken: boolean;
}

/**
 * Everything the decision reads.
 *
 * `approvals` must be the votes for **this entry and this locale** — revisions
 * are already numbered per entry and keyed per locale, so the caller's query
 * carries the scoping and this function trusts it. Passing another entry's
 * votes is a caller bug the domain cannot see.
 */
export interface ProtectionInput {
    /** Absent means the type is unprotected. */
    readonly rule?: ProtectionRule;
    /** The entry's current revision, for this locale. */
    readonly headRevisionId: string;
    /**
     * Who wrote the head revision, or `null` when that cannot be named — a
     * deleted user, an import, a migration.
     */
    readonly headAuthorId: string | null;
    readonly approvals: readonly Approval[];
    readonly actor: ProtectionActor;
}
