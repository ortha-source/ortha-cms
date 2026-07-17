/**
 * Raised by {@link MemberId.create} when a member id is not a UUID.
 * Transport-agnostic — controllers already validate the route param with
 * `ParseUUIDPipe`, so this is a defensive guard on the domain boundary.
 */
export class InvalidMemberIdError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid member id: ${value}`);
        this.name = 'InvalidMemberIdError';
    }
}
