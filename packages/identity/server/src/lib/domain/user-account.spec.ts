import { UserAccount } from './user-account';
import { PasswordHash } from './value-objects/password-hash';
import { IDENTITY_EVENT_KINDS } from './events/identity-events';
import { InvalidUserStateError } from './errors';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HASH = PasswordHash.create('$2b$12$abcdefghijklmnopqrstuv');

/** A loaded account with the given status (active with a credential by default). */
function rehydrated(
    overrides: { status?: string; passwordHash?: string | null } = {}
): UserAccount {
    return UserAccount.rehydrate({
        id: USER_ID,
        email: 'ada@example.com',
        status: overrides.status ?? 'active',
        passwordHash:
            overrides.passwordHash === undefined
                ? '$2b$12$abcdefghijklmnopqrstuv'
                : overrides.passwordHash
    });
}

describe('UserAccount aggregate', () => {
    describe('activate', () => {
        it('activates a pending account, sets the credential, raises user.activated', () => {
            const account = rehydrated({
                status: 'pending',
                passwordHash: null
            });
            account.activate(HASH);

            expect(account.status.value).toBe('active');
            expect(account.passwordHash?.value).toBe(HASH.value);
            expect(account.changes()).toEqual({
                statusChanged: true,
                credentialChanged: true
            });
            expect(account.pullEvents().map((event) => event.kind)).toEqual([
                IDENTITY_EVENT_KINDS.USER_ACTIVATED
            ]);
        });

        it('rejects activating a non-pending account', () => {
            const account = rehydrated({ status: 'active' });
            expect(() => account.activate(HASH)).toThrow(InvalidUserStateError);
        });
    });

    describe('disable', () => {
        it('disables an active account and raises user.disabled', () => {
            const account = rehydrated();
            account.disable();
            expect(account.status.value).toBe('disabled');
            expect(account.changes().statusChanged).toBe(true);
            expect(account.pullEvents()[0].kind).toBe(
                IDENTITY_EVENT_KINDS.USER_DISABLED
            );
        });

        it('rejects disabling a non-active account', () => {
            const account = rehydrated({
                status: 'pending',
                passwordHash: null
            });
            expect(() => account.disable()).toThrow(InvalidUserStateError);
        });
    });

    describe('enable', () => {
        it('re-enables a disabled account and raises user.enabled', () => {
            const account = rehydrated({ status: 'disabled' });
            account.enable();
            expect(account.status.value).toBe('active');
            expect(account.pullEvents()[0].kind).toBe(
                IDENTITY_EVENT_KINDS.USER_ENABLED
            );
        });

        it('rejects enabling a non-disabled account', () => {
            const account = rehydrated({ status: 'active' });
            expect(() => account.enable()).toThrow(InvalidUserStateError);
        });
    });

    describe('changeCredential', () => {
        it('changes the credential of an active account and raises user.password_changed', () => {
            const account = rehydrated();
            const next = PasswordHash.create('$2b$12$zzzzzzzzzzzzzzzzzzzzzz');
            account.changeCredential(next);
            expect(account.passwordHash?.value).toBe(next.value);
            expect(account.changes().credentialChanged).toBe(true);
            expect(account.pullEvents()[0].kind).toBe(
                IDENTITY_EVENT_KINDS.PASSWORD_CHANGED
            );
        });

        it('rejects changing the credential of a disabled account', () => {
            const account = rehydrated({ status: 'disabled' });
            expect(() => account.changeCredential(HASH)).toThrow(
                InvalidUserStateError
            );
        });
    });

    it('rehydrate carries no pending changes or events', () => {
        const account = rehydrated();
        expect(account.changes()).toEqual({
            statusChanged: false,
            credentialChanged: false
        });
        expect(account.pullEvents()).toHaveLength(0);
    });
});
