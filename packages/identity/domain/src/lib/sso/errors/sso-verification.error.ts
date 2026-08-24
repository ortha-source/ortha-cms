/**
 * An identity provider's response could not be verified, or the provider
 * refused the sign-in.
 *
 * **One error type for every rejection**, deliberately: a bad signature, an
 * expired assertion, a `nonce` that does not match, a `state` that does not
 * match, and the provider's own `error=access_denied` all reach an anonymous
 * caller as the same failure. Differentiating them would let someone with no
 * account probe how far into the handshake they got — the same reasoning that
 * collapses every invalid invite and reset link to one bare 404.
 *
 * `reason` is for the server log, never for the response body.
 */
export class SsoVerificationError extends Error {
    constructor(
        /** What actually failed. Logged; never rendered to the caller. */
        readonly reason: string
    ) {
        super(`SSO verification failed: ${reason}.`);
        this.name = 'SsoVerificationError';
    }
}
