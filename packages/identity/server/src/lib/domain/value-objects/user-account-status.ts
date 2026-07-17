import { InvalidUserStatusError } from '../errors';

/**
 * The account lifecycle states a user can be in — mirrors identity's
 * `user_status` enum. `pending` is an unaccepted invite (no credential yet).
 */
export const USER_ACCOUNT_STATUSES = ['pending', 'active', 'disabled'] as const;

/** One of the {@link USER_ACCOUNT_STATUSES} lifecycle keys. */
export type UserAccountStatusKey = (typeof USER_ACCOUNT_STATUSES)[number];

/**
 * A user account's lifecycle status. New accounts start `pending`; accepting an
 * invite activates them, and an admin may `disable`/`enable` an active account.
 */
export class UserAccountStatus {
    private constructor(private readonly status: UserAccountStatusKey) {}

    /** The `pending` status (an unaccepted invite). */
    static pending(): UserAccountStatus {
        return new UserAccountStatus('pending');
    }

    /** The `active` status. */
    static active(): UserAccountStatus {
        return new UserAccountStatus('active');
    }

    /** The `disabled` status. */
    static disabled(): UserAccountStatus {
        return new UserAccountStatus('disabled');
    }

    /**
     * Builds a {@link UserAccountStatus} from a raw key, rejecting an unknown
     * one with {@link InvalidUserStatusError}.
     */
    static create(value: string): UserAccountStatus {
        if (!USER_ACCOUNT_STATUSES.includes(value as UserAccountStatusKey)) {
            throw new InvalidUserStatusError(value);
        }
        return new UserAccountStatus(value as UserAccountStatusKey);
    }

    /** The underlying status key. */
    get value(): UserAccountStatusKey {
        return this.status;
    }

    /** Whether this is the `pending` state. */
    get isPending(): boolean {
        return this.status === 'pending';
    }

    /** Whether this is the `active` state. */
    get isActive(): boolean {
        return this.status === 'active';
    }

    /** Whether this is the `disabled` state. */
    get isDisabled(): boolean {
        return this.status === 'disabled';
    }

    /** Structural equality on the underlying key. */
    equals(other: UserAccountStatus): boolean {
        return this.status === other.status;
    }
}
