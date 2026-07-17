/**
 * Raised by {@link MemberStatus.create} when a status key is not one of the
 * lifecycle states (`pending` / `active` / `disabled`). Transport-agnostic.
 */
export class InvalidMemberStatusError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid member status: ${value}`);
        this.name = 'InvalidMemberStatusError';
    }
}
