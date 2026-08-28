import { InvalidUserStatusError } from '../errors';
import {
    USER_ACCOUNT_STATUSES,
    UserAccountStatus
} from './user-account-status';

/**
 * The lifecycle enum mirrors the database's `user_status` type, and the
 * aggregate branches on the three predicates rather than on string comparisons.
 * A status the enum does not know must fail on the way in: rehydrating one
 * would produce an account that is neither pending, active nor disabled, and
 * every transition guard would then refuse it for the wrong reason.
 */
describe('UserAccountStatus', () => {
    describe('create', () => {
        it.each(USER_ACCOUNT_STATUSES)('accepts %p', (value) => {
            expect(UserAccountStatus.create(value).value).toBe(value);
        });

        it.each(['suspended', '', 'ACTIVE', 'deleted', 'pending '])(
            'rejects %p',
            (value) => {
                expect(() => UserAccountStatus.create(value)).toThrow(
                    InvalidUserStatusError
                );
            }
        );
    });

    describe('the lifecycle predicates', () => {
        it.each([
            ['pending', [true, false, false]],
            ['active', [false, true, false]],
            ['disabled', [false, false, true]]
        ] as const)('%p answers exactly one of them', (value, expected) => {
            const status = UserAccountStatus.create(value);
            expect([
                status.isPending,
                status.isActive,
                status.isDisabled
            ]).toEqual(expected);
        });

        it('matches the named constructors', () => {
            expect(
                UserAccountStatus.pending().equals(
                    UserAccountStatus.create('pending')
                )
            ).toBe(true);
            expect(
                UserAccountStatus.active().equals(
                    UserAccountStatus.create('active')
                )
            ).toBe(true);
            expect(
                UserAccountStatus.disabled().equals(
                    UserAccountStatus.create('disabled')
                )
            ).toBe(true);
        });

        it('is not equal across statuses', () => {
            expect(
                UserAccountStatus.active().equals(UserAccountStatus.pending())
            ).toBe(false);
        });
    });
});
