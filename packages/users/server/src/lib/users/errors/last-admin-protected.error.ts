/**
 * Thrown when an operation would leave the system without an active
 * administrator — demoting or disabling the last remaining admin.
 * Transport-agnostic — controllers map it to HTTP 409.
 */
export class LastAdminProtectedError extends Error {
    constructor(public readonly userId: string) {
        super(
            `The last remaining administrator cannot be demoted or disabled: ${userId}`
        );
        this.name = 'LastAdminProtectedError';
    }
}
