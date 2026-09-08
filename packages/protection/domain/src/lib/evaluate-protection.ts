/**
 * The protection decision — the **third** gate on publication, after the
 * `content:publish` permission and after the publish gate.
 *
 * It answers *who*, never *what*. A protected entry that fails the publish gate
 * fails the publish gate; approvals do not make an incomplete entry
 * publishable, and neither does a bypass.
 *
 * Deliberately **not** called `canPublish`: `content/domain` already exports
 * that name for the publish gate, and two functions of one name deciding
 * different halves of the same button is the two-authorities confusion ADR-0015
 * exists to prevent.
 */

import { APPROVAL_DECISION, type ProtectionInput } from './protection-rule';

/**
 * What the gate decided.
 *
 * `bypassable` is **reported, never applied**: it says a bypass is possible,
 * and the caller must still supply a reason to take one. A decision that
 * allowed the publish here would ship it without the log row that is the whole
 * reason bypassing is permitted at all.
 */
export type ProtectionDecision =
    | {
          readonly allowed: true;
          /** `unprotected` — no rule, or one switched off. */
          readonly reason: 'unprotected' | 'satisfied';
      }
    | { readonly allowed: false; readonly reason: 'token-refused' }
    | {
          readonly allowed: false;
          readonly reason: 'insufficient-approvals';
          readonly required: number;
          /** Distinct people whose vote counts toward the head. */
          readonly given: number;
          /**
           * Distinct people whose only approval sits on an earlier revision —
           * why the count moved after a save, and who the interface strikes
           * through. Zero when stale approvals are being counted anyway.
           */
          readonly stale: number;
          readonly bypassable: boolean;
      };

/**
 * The distinct people whose `approved` vote is eligible, either on the head
 * revision alone or across every revision.
 *
 * Distinct by user in both cases: `unique (revision_id, user_id)` stops one
 * person voting twice on one version, but nothing stops them approving five
 * versions in a row, and a naive sum would turn one reviewer into five the
 * moment `countStaleApprovals` is switched on.
 */
function approvers(
    input: ProtectionInput,
    requireOtherPerson: boolean,
    headOnly: boolean
): Set<string> {
    const users = new Set<string>();

    for (const approval of input.approvals) {
        // A `changes_requested` is zero votes plus an explanation, never a
        // subtraction: a reviewer who wants to block simply does not approve.
        // Otherwise one reviewer going on holiday holds the workspace hostage.
        if (approval.decision !== APPROVAL_DECISION.Approved) continue;
        if (headOnly && approval.revisionId !== input.headRevisionId) continue;
        // A head author we cannot name excludes nobody. Refusing every approval
        // on the entry instead would block on something there is nothing to
        // point at.
        if (
            requireOtherPerson &&
            input.headAuthorId !== null &&
            approval.userId === input.headAuthorId
        ) {
            continue;
        }
        users.add(approval.userId);
    }

    return users;
}

/** Where the approval count stands, whether or not that is enough to publish. */
export interface ApprovalCounts {
    /** Distinct people whose vote counts toward the head revision. */
    readonly given: number;
    /**
     * Distinct people whose only approval sits on an earlier revision — why the
     * count moved after a save, and who the interface strikes through. Zero
     * when stale approvals are being counted anyway, because then they are not
     * stale.
     */
    readonly stale: number;
}

/**
 * The counts on their own, for a surface that has to render "2 of 2" — which
 * {@link ProtectionDecision} does not carry, because a satisfied publish has
 * nothing to explain.
 *
 * Exported so the editor's panel and the gate that refuses the publish are
 * **one implementation of counting**, not two that agree until somebody
 * switches on `countStaleApprovals`. `evaluateProtection` calls this; a caller
 * that only wants the numbers calls it directly rather than asking the gate a
 * question it is rigged to refuse.
 *
 * With no rule, the counting flags take their documented defaults — the head
 * author excluded, stale approvals not counted — which is what a type shows
 * before anybody protects it, and what it would show if a rule were switched on
 * as it stands.
 */
export function countApprovals(input: ProtectionInput): ApprovalCounts {
    const requireOtherPerson = input.rule?.requireOtherPerson ?? true;
    const countStale = input.rule?.countStaleApprovals ?? false;

    const onHead = approvers(input, requireOtherPerson, true);
    const everywhere = approvers(input, requireOtherPerson, false);

    // `everywhere` is always a superset of `onHead`, so `stale` cannot go
    // negative — and it falls to zero on its own when the stale ones are being
    // counted, because then they are not stale.
    const given = countStale ? everywhere.size : onHead.size;

    return { given, stale: everywhere.size - given };
}

/** Whether `actor` may publish `entry` past `rule`, and if not, why. */
export function evaluateProtection(input: ProtectionInput): ProtectionDecision {
    const { rule, actor } = input;

    // A rule that is absent and a rule that is switched off are the same state,
    // and the token gate sits *after* this: refusing a key on a type nobody
    // chose to protect would break a deploy that never opted in.
    if (!rule || !rule.enabled) {
        return { allowed: true, reason: 'unprotected' };
    }

    // Before the count, and regardless of it. A token holds `content:publish`
    // in the `full` scope and names nobody in the log, so a rule that let one
    // through by default would be escaped by minting a key.
    if (actor.isToken && !rule.allowTokenPublish) {
        return { allowed: false, reason: 'token-refused' };
    }

    const { given, stale } = countApprovals(input);

    if (given >= rule.requiredApprovals) {
        return { allowed: true, reason: 'satisfied' };
    }

    return {
        allowed: false,
        reason: 'insufficient-approvals',
        required: rule.requiredApprovals,
        given,
        stale,
        // A token never bypasses: there is no human to demand a reason from and
        // no name to write into the log row.
        bypassable: rule.adminBypass && actor.isAdmin && !actor.isToken
    };
}
