import { describe, expect, it } from 'vitest';
import { MemberEntity } from './index';
import type { Member, MemberRole } from '../types/member';

const VIEWER_ID = 'viewer-1';
const OTHER_ID = 'other-1';

/** A plain member view model; each test overrides only what it is about. */
function member(overrides: Partial<Member> = {}): Member {
    return {
        id: OTHER_ID,
        name: 'Grace Hopper',
        email: 'grace@example.com',
        initials: 'GH',
        color: 'blue',
        role: 'contributor' as MemberRole,
        roleName: 'Contributor',
        status: 'active',
        joinedAt: new Date('2026-06-01T10:00:00.000Z'),
        isLastAdmin: false,
        workspaces: [],
        ...overrides
    } as Member;
}

describe('MemberEntity.canChangeRole', () => {
    it('allows re-roling an ordinary member', () => {
        expect(MemberEntity.of(member()).canChangeRole(VIEWER_ID)).toEqual({
            ok: true,
            reason: null
        });
    });

    it('vetoes changing your own role', () => {
        // The server 409s this. Mirroring it here is the whole point: without
        // the check the picker invites a click that can never succeed and then
        // reports a generic "please try again".
        expect(
            MemberEntity.of(member({ id: VIEWER_ID })).canChangeRole(VIEWER_ID)
        ).toEqual({ ok: false, reason: 'self' });
    });

    it('vetoes demoting the sole active admin', () => {
        expect(
            MemberEntity.of(member({ isLastAdmin: true })).canChangeRole(
                VIEWER_ID
            )
        ).toEqual({ ok: false, reason: 'lastAdmin' });
    });

    it('vetoes a member holding a custom role the picker cannot represent', () => {
        expect(
            MemberEntity.of(member({ role: null })).canChangeRole(VIEWER_ID)
        ).toEqual({ ok: false, reason: 'customRole' });
    });

    it('reports self before last-admin when the viewer is both', () => {
        // Both apply to a sole admin looking at their own profile; `self` is
        // the more specific and more actionable reason.
        expect(
            MemberEntity.of(
                member({ id: VIEWER_ID, isLastAdmin: true })
            ).canChangeRole(VIEWER_ID)
        ).toEqual({ ok: false, reason: 'self' });
    });

    it('falls back to the other guards when the viewer is unknown', () => {
        expect(MemberEntity.of(member()).canChangeRole(undefined)).toEqual({
            ok: true,
            reason: null
        });
        expect(
            MemberEntity.of(member({ isLastAdmin: true })).canChangeRole(
                undefined
            )
        ).toEqual({ ok: false, reason: 'lastAdmin' });
    });
});

describe('MemberEntity.canBeRemoved', () => {
    it('allows disabling an ordinary member', () => {
        expect(MemberEntity.of(member()).canBeRemoved(VIEWER_ID)).toEqual({
            ok: true,
            reason: null
        });
    });

    it('vetoes disabling your own account', () => {
        expect(
            MemberEntity.of(member({ id: VIEWER_ID })).canBeRemoved(VIEWER_ID)
        ).toEqual({ ok: false, reason: 'self' });
    });

    it('vetoes disabling the sole active admin', () => {
        expect(
            MemberEntity.of(member({ isLastAdmin: true })).canBeRemoved(
                VIEWER_ID
            )
        ).toEqual({ ok: false, reason: 'lastAdmin' });
    });

    it('does not veto a custom-role member — disabling is role-agnostic', () => {
        expect(
            MemberEntity.of(member({ role: null })).canBeRemoved(VIEWER_ID)
        ).toEqual({ ok: true, reason: null });
    });
});
