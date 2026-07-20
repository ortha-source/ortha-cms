import { InvalidMemberStatusError } from '../errors';

/**
 * The account lifecycle states a member can be in — mirrors identity's
 * `user_status` enum. `pending` is an unaccepted invite.
 */
export const MEMBER_STATUSES = ['pending', 'active', 'disabled'] as const;

/** One of the {@link MEMBER_STATUSES} lifecycle keys. */
export type MemberStatusKey = (typeof MEMBER_STATUSES)[number];

/**
 * A member's account lifecycle status. Invited members start `pending`;
 * `disable`/`enable` flip between `active` and `disabled`.
 */
export class MemberStatus {
    private constructor(private readonly status: MemberStatusKey) {}

    /** The `pending` status (an unaccepted invite). */
    static pending(): MemberStatus {
        return new MemberStatus('pending');
    }

    /** The `active` status. */
    static active(): MemberStatus {
        return new MemberStatus('active');
    }

    /** The `disabled` status. */
    static disabled(): MemberStatus {
        return new MemberStatus('disabled');
    }

    /**
     * Builds a {@link MemberStatus} from a raw key, rejecting an unknown one
     * with {@link InvalidMemberStatusError}.
     */
    static create(value: string): MemberStatus {
        if (!MEMBER_STATUSES.includes(value as MemberStatusKey)) {
            throw new InvalidMemberStatusError(value);
        }
        return new MemberStatus(value as MemberStatusKey);
    }

    /** The underlying status key. */
    get value(): MemberStatusKey {
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
    equals(other: MemberStatus): boolean {
        return this.status === other.status;
    }
}
