/**
 * A back-channel logout notification was refused.
 *
 * One error for every reason, like {@link SsoLoginFailedError} and for a
 * sharper version of the same argument: this endpoint is unauthenticated, and
 * a caller who could tell "that token did not verify" from "that person has no
 * account here" would have an oracle for which of a directory's members use
 * this CMS.
 */
export class SsoLogoutFailedError extends Error {
    constructor(readonly reason: string) {
        super(`SSO back-channel logout failed: ${reason}.`);
        this.name = 'SsoLogoutFailedError';
    }
}
