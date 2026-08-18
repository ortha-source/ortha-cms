import { Member } from './member';
import { Role } from './value-objects/role';
import { InvalidMemberStateError, LastAdminProtectedError } from './errors';
import { MEMBER_EVENT_KINDS } from './events/member-events';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

/** A loaded member with the given role/status (active admin by default). */
function rehydrated(
    overrides: { roleKey?: string; status?: string } = {}
): Member {
    return Member.rehydrate({
        id: MEMBER_ID,
        email: 'ada@example.com',
        name: 'Ada',
        roleKey: overrides.roleKey ?? 'admin',
        status: overrides.status ?? 'active'
    });
}

describe('Member aggregate', () => {
    describe('invite', () => {
        it('creates a pending member and raises member.invited', () => {
            const member = Member.invite({
                email: 'grace@example.com',
                name: null,
                role: Role.create('contributor')
            });

            expect(member.changes().isNew).toBe(true);
            expect(member.status.value).toBe('pending');
            expect(member.email).toBe('grace@example.com');

            const events = member.pullEvents();
            expect(events.map((event) => event.kind)).toEqual([
                MEMBER_EVENT_KINDS.INVITED
            ]);
            expect(events[0].aggregateId).toBe(member.id.value);
            expect(events[0].payload).toEqual({ email: 'grace@example.com' });
        });
    });

    describe('rename', () => {
        it('is a no-op when the name is unchanged', () => {
            const member = rehydrated();
            expect(member.rename('Ada')).toBe(false);
            expect(member.changes().nameChanged).toBe(false);
        });

        it('applies a new name and raises no event', () => {
            const member = rehydrated();
            expect(member.rename('Ada Lovelace')).toBe(true);
            expect(member.name).toBe('Ada Lovelace');
            expect(member.changes().nameChanged).toBe(true);
            expect(member.pullEvents()).toHaveLength(0);
        });
    });

    describe('changeRole', () => {
        it('is a no-op when the role is unchanged', () => {
            const member = rehydrated();
            expect(member.changeRole(Role.create('admin'), 5)).toBe(false);
            expect(member.pullEvents()).toHaveLength(0);
        });

        it('demotes an admin and raises member.role_changed with the transition', () => {
            const member = rehydrated();
            expect(member.changeRole(Role.create('viewer'), 2)).toBe(true);
            expect(member.role.value).toBe('viewer');
            const [event] = member.pullEvents();
            expect(event.kind).toBe(MEMBER_EVENT_KINDS.ROLE_CHANGED);
            expect(event.payload).toEqual({ from: 'admin', to: 'viewer' });
        });

        it('refuses to demote the last active admin', () => {
            const member = rehydrated();
            expect(() =>
                member.changeRole(Role.create('viewer'), 1)
            ).toThrow(LastAdminProtectedError);
        });

        it('allows demoting a non-last admin', () => {
            const member = rehydrated();
            expect(member.changeRole(Role.create('viewer'), 2)).toBe(true);
        });

        it('allows demoting an admin who is not active (pending)', () => {
            const member = rehydrated({ status: 'pending' });
            expect(member.changeRole(Role.create('viewer'), 1)).toBe(true);
        });

        it('promoting to admin never trips the guard', () => {
            const member = rehydrated({ roleKey: 'viewer' });
            expect(member.changeRole(Role.create('admin'), 1)).toBe(true);
        });
    });

    describe('disable', () => {
        it('disables an active member and raises member.disabled', () => {
            const member = rehydrated({ roleKey: 'contributor' });
            expect(member.disable(1)).toBe(true);
            expect(member.status.value).toBe('disabled');
            expect(member.pullEvents()[0].kind).toBe(
                MEMBER_EVENT_KINDS.DISABLED
            );
        });

        it('refuses to disable the last active admin', () => {
            const member = rehydrated();
            expect(() => member.disable(1)).toThrow(LastAdminProtectedError);
        });

        it('disables a non-last admin', () => {
            const member = rehydrated();
            expect(member.disable(2)).toBe(true);
        });

        it('rejects disabling a non-active member (checked before the admin guard)', () => {
            const member = rehydrated({ status: 'pending' });
            expect(() => member.disable(1)).toThrow(InvalidMemberStateError);
        });
    });

    describe('enable', () => {
        it('re-enables a disabled member', () => {
            const member = rehydrated({ status: 'disabled' });
            expect(member.enable()).toBe(true);
            expect(member.status.value).toBe('active');
            expect(member.pullEvents()).toHaveLength(0);
        });

        it('rejects enabling a non-disabled member', () => {
            const member = rehydrated({ status: 'active' });
            expect(() => member.enable()).toThrow(InvalidMemberStateError);
        });
    });

    describe('ensureCanResendInvite', () => {
        it('passes for a pending member', () => {
            const member = rehydrated({ status: 'pending' });
            expect(() => member.ensureCanResendInvite()).not.toThrow();
        });

        it('rejects a non-pending member', () => {
            const member = rehydrated({ status: 'active' });
            expect(() => member.ensureCanResendInvite()).toThrow(
                InvalidMemberStateError
            );
        });
    });

    describe('ensureCanResetPassword', () => {
        it('passes for an active member', () => {
            const member = rehydrated({ status: 'active' });
            expect(() => member.ensureCanResetPassword()).not.toThrow();
        });

        it('rejects a pending member — there is no password to reset yet', () => {
            const member = rehydrated({ status: 'pending' });
            expect(() => member.ensureCanResetPassword()).toThrow(
                InvalidMemberStateError
            );
        });

        it('rejects a disabled member — a reset must not reopen a closed account', () => {
            const member = rehydrated({ status: 'disabled' });
            expect(() => member.ensureCanResetPassword()).toThrow(
                InvalidMemberStateError
            );
        });
    });

    describe('revokeInvite', () => {
        it('raises member.removed for a pending member', () => {
            const member = rehydrated({ status: 'pending' });
            member.revokeInvite();
            const [event] = member.pullEvents();
            expect(event.kind).toBe(MEMBER_EVENT_KINDS.REMOVED);
            expect(event.payload).toEqual({ email: 'ada@example.com' });
        });

        it('rejects revoking a non-pending member', () => {
            const member = rehydrated({ status: 'active' });
            expect(() => member.revokeInvite()).toThrow(
                InvalidMemberStateError
            );
        });
    });
});
