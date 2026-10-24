import type { ProtectionRule } from './types';

/**
 * The exceptions a rule makes to "N people other than the author, on this
 * version, every time" — in the order the editor lists its switches. Each one
 * **loosens** the rule, which is why it is worth saying: the strict defaults go
 * without saying, a relaxation does not.
 */
export type RuleException =
    | 'authorMayApprove'
    | 'keepsAcrossSaves'
    | 'adminsOverride'
    | 'tokensPublish';

/** What a rule does, as the one sentence and the one-line hint read it. */
export type RuleReading =
    | { kind: 'off' }
    | {
          kind: 'on';
          /** Approvals needed. */
          count: number;
          /** Whether those approvals must come from somebody but the author. */
          fromOthers: boolean;
          /** What it lets through besides, in switch order. */
          exceptions: RuleException[];
      };

/**
 * Reads a rule back as what it does, so the editor's "In short" sentence and
 * the settings list's hint are one interpretation rather than two.
 *
 * A rule that is switched off reads as `off` whatever else it holds: off
 * behaves exactly as no rule at all (ADR-0017), so saying "needs 2 approvals"
 * over it would describe a requirement nobody meets.
 *
 * `fromOthers` is folded into the main clause rather than listed as an
 * exception, because the four-eyes rule is the default and the sentence reads
 * naturally only one way round — "needs 2 approvals from people other than its
 * author". Turning it off is then the exception `authorMayApprove`, which the
 * one-line hint (with no room for the full clause) needs said on its own.
 */
export function readRule(rule: ProtectionRule | null): RuleReading {
    if (!rule?.enabled) return { kind: 'off' };
    const exceptions: RuleException[] = [];
    if (!rule.requireOtherPerson) exceptions.push('authorMayApprove');
    if (rule.countStaleApprovals) exceptions.push('keepsAcrossSaves');
    if (rule.adminBypass) exceptions.push('adminsOverride');
    if (rule.allowTokenPublish) exceptions.push('tokensPublish');
    return {
        kind: 'on',
        count: rule.requiredApprovals,
        fromOthers: rule.requireOtherPerson,
        exceptions
    };
}

/** The editor's quick picks for "Approvals needed"; anything else is "Other…". */
export const APPROVAL_PRESETS = [1, 2, 3] as const;

/** Which segment a count selects: a preset, or `other`. */
export function approvalSegment(count: number): string {
    return (APPROVAL_PRESETS as readonly number[]).includes(count)
        ? String(count)
        : 'other';
}
