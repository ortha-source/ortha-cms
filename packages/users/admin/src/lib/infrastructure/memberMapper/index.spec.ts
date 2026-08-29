import { describe, expect, it } from 'vitest';
import {
    toInvitedMember,
    toMember,
    toMemberWithResetToken,
    type MemberResponse
} from './index';

/** A minimal wire member; each test overrides only what it is about. */
function response(overrides: Partial<MemberResponse> = {}): MemberResponse {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'grace@example.com',
        name: 'Grace Hopper',
        role: { id: 'r1', key: 'contributor', name: 'Contributor' },
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
        isLastAdmin: false,
        workspaces: [],
        ...overrides
    };
}

describe('toMember', () => {
    it('keeps each of the three assignable system roles', () => {
        for (const key of ['admin', 'contributor', 'viewer'] as const) {
            const member = toMember(
                response({ role: { id: 'r', key, name: key } })
            );
            expect(member.role).toBe(key);
        }
    });

    it('maps an unknown role key to null rather than guessing viewer', () => {
        // The server's `Role.create` accepts any non-empty key, so a custom
        // role is a shape the admin must expect. Coercing it to `viewer` would
        // make the roster and the Role tab assert a privilege level the member
        // does not hold.
        const member = toMember(
            response({ role: { id: 'r9', key: 'editor', name: 'Editor' } })
        );

        expect(member.role).toBeNull();
        expect(member.roleName).toBe('Editor');
    });

    it('substitutes the email for a member who has not accepted yet', () => {
        const member = toMember(
            response({ name: null, email: 'pending@example.com' })
        );

        expect(member.name).toBe('pending@example.com');
        expect(member.initials).toBeTruthy();
    });

    it('parses the created timestamp into a Date', () => {
        const member = toMember(
            response({ createdAt: '2026-06-01T10:00:00.000Z' })
        );

        expect(member.joinedAt).toBeInstanceOf(Date);
        expect(member.joinedAt.toISOString()).toBe('2026-06-01T10:00:00.000Z');
    });

    it('carries the server-computed last-admin flag through untouched', () => {
        expect(toMember(response({ isLastAdmin: true })).isLastAdmin).toBe(
            true
        );
        expect(toMember(response({ isLastAdmin: false })).isLastAdmin).toBe(
            false
        );
    });
});

describe('toMember workspaces', () => {
    /** A wire workspace; each test overrides only what it is about. */
    function workspace(color: string) {
        return {
            id: 'w1',
            name: 'Acme Marketing',
            description: null,
            color
        };
    }

    it('keeps a colour the palette actually has', () => {
        const [ws] = toMember(
            response({ workspaces: [workspace('violet')] })
        ).workspaces;

        expect(ws.color).toBe('violet');
    });

    it('rewrites an unknown colour to the neutral slate', () => {
        // A mapper fallback that silently rewrites data is worth pinning
        // rather than discovering: `asAvatarColor` does NOT pass an unknown
        // value through, it substitutes `slate`. So a workspace colour the
        // design system has since dropped (or a typo'd one) renders neutral
        // instead of un-styled — deliberate, but it means the admin can never
        // surface that the stored colour is bogus.
        const [ws] = toMember(
            response({ workspaces: [workspace('fuchsia')] })
        ).workspaces;

        expect(ws.color).toBe('slate');
    });

    it('derives the workspace initials from its name', () => {
        const [ws] = toMember(
            response({ workspaces: [workspace('violet')] })
        ).workspaces;

        expect(ws.initials).toBe('AM');
        expect(ws.description).toBeNull();
    });
});

describe('toInvitedMember', () => {
    it('carries the one-time invite token through verbatim', () => {
        // The raw token is readable exactly once — the server keeps only its
        // hash — so a mapper that dropped, trimmed or re-cased it would leave
        // the admin with a dead link and no way to recover the live one short
        // of resending, which rotates the token again.
        const token = 'Inv+Token/With=Padding';

        expect(toInvitedMember({ ...response(), inviteToken: token })).toEqual(
            expect.objectContaining({ inviteToken: token })
        );
    });

    it('still maps the member alongside the token', () => {
        const invited = toInvitedMember({
            ...response({ name: null, email: 'pending@example.com' }),
            inviteToken: 't'
        });

        expect(invited.name).toBe('pending@example.com');
        expect(invited.role).toBe('contributor');
    });
});

describe('toMemberWithResetToken', () => {
    it('carries the one-time reset token through verbatim', () => {
        // Same irreversibility as the invite token, and worse to lose: the
        // server refuses a second mint for a minute, so a mangled token is not
        // even immediately re-issuable.
        const token = 'Reset+Token/With=Padding';

        expect(
            toMemberWithResetToken({ ...response(), resetToken: token })
        ).toEqual(expect.objectContaining({ resetToken: token }));
    });

    it('still maps the member alongside the token', () => {
        const member = toMemberWithResetToken({
            ...response({ status: 'active' }),
            resetToken: 't'
        });

        expect(member.status).toBe('active');
        expect(member.email).toBe('grace@example.com');
    });
});
