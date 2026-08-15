import { describe, expect, it } from 'vitest';
import { toMember, type MemberResponse } from './index';

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
