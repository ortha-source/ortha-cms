import { describe, expect, it } from 'vitest';
import { DEFAULT_PROTECTION_RULE } from './types';
import { approvalSegment, readRule } from './ruleSummary';

const on = { ...DEFAULT_PROTECTION_RULE, enabled: true };

describe('readRule', () => {
    it('reads no rule, and a switched-off one, as off', () => {
        expect(readRule(null)).toEqual({ kind: 'off' });
        // Off is no rule at all — what it would otherwise demand is not said.
        expect(
            readRule({ ...on, enabled: false, requiredApprovals: 3 })
        ).toEqual({ kind: 'off' });
    });

    it('reads the defaults as approvals from others, with admins able to override', () => {
        expect(readRule({ ...on, requiredApprovals: 2 })).toEqual({
            kind: 'on',
            count: 2,
            fromOthers: true,
            exceptions: ['adminsOverride']
        });
    });

    it('lists every loosening, in the order the switches are drawn', () => {
        expect(
            readRule({
                ...on,
                requireOtherPerson: false,
                countStaleApprovals: true,
                adminBypass: true,
                allowTokenPublish: true
            })
        ).toEqual({
            kind: 'on',
            count: 1,
            fromOthers: false,
            exceptions: [
                'authorMayApprove',
                'keepsAcrossSaves',
                'adminsOverride',
                'tokensPublish'
            ]
        });
    });

    it('says nothing extra about a rule with no exceptions', () => {
        expect(readRule({ ...on, adminBypass: false })).toMatchObject({
            exceptions: []
        });
    });
});

describe('approvalSegment', () => {
    it('selects a preset for 1–3 and "other" beyond', () => {
        expect(approvalSegment(1)).toBe('1');
        expect(approvalSegment(3)).toBe('3');
        expect(approvalSegment(4)).toBe('other');
        expect(approvalSegment(12)).toBe('other');
    });
});
