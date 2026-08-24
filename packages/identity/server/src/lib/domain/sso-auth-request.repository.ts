/** A freshly opened attempt: the browser's token plus the provider's secrets. */
export interface StartedSsoAuthRequest {
    /**
     * The opaque token handed to the browser in a short-lived cookie. Only its
     * SHA-256 is stored, exactly like a session token, so a read-only database
     * leak yields nothing that can resume an attempt.
     */
    token: string;
    /** The CSRF value to send to the provider. */
    state: string;
    /** The replay-defence value to bind into the provider's identity token. */
    nonce: string;
    /** The PKCE verifier, to be spent at the token exchange. */
    codeVerifier: string;
    /** Absolute expiry. */
    expiresAt: Date;
}

/** A live attempt, as the callback finds it. */
export interface PendingSsoAuthRequest {
    /** The row id — what {@link SsoAuthRequestRepository.consume} burns. */
    id: string;
    /** The provider this attempt was started against. */
    provider: string;
    /** The stored CSRF value, to compare against what the provider echoed. */
    state: string;
    /** The stored replay-defence value. */
    nonce: string;
    /** The stored PKCE verifier. */
    codeVerifier: string;
    /** The already-validated same-origin path to land on. */
    redirectTo: string;
    /**
     * The SHA-256 of the invite token this attempt was started from, or `null`
     * for an ordinary sign-in. Its presence is what puts the callback on the
     * invite-acceptance path rather than the sign-in one.
     */
    inviteTokenHash: string | null;
}

/** What opening an attempt needs from the caller. */
export interface OpenSsoAuthRequestInput {
    /** The provider being started. */
    provider: string;
    /** Where to land afterwards. Must already have passed `safeRedirectPath`. */
    redirectTo: string;
    /** How long the attempt stays live. One click, so seconds not days. */
    ttlSeconds: number;
    /**
     * The SHA-256 of an invite token, when the attempt was started from an
     * invite link. Hashed by the caller, like every other token here — the raw
     * value never reaches the port.
     */
    inviteTokenHash?: string | null;
}

/**
 * The persistence **port** for in-flight sign-in attempts.
 *
 * The adapter mints `state`, `nonce`, the PKCE verifier and the browser token,
 * mirroring `SessionRepository.issue`, which mints the session token rather than
 * taking one: high-entropy randomness and its hashing are one concern, and the
 * flows above should not be able to get it subtly wrong in two places.
 */
export interface SsoAuthRequestRepository {
    /** Opens an attempt and returns its secrets. */
    open(input: OpenSsoAuthRequestInput): Promise<StartedSsoAuthRequest>;

    /**
     * The live attempt an opaque browser token names — unconsumed and
     * unexpired — or `null`. A pure read; {@link consume} is what makes it
     * one-time.
     */
    findPendingByToken(token: string): Promise<PendingSsoAuthRequest | null>;

    /**
     * Burns an attempt: a single conditional `UPDATE … WHERE consumed_at IS
     * NULL RETURNING`, never a read-then-write. Of two concurrent callbacks
     * replaying one response, exactly one gets `true`.
     */
    consume(id: string): Promise<boolean>;
}

/**
 * DI token the infrastructure adapter binds to an
 * {@link SsoAuthRequestRepository}.
 */
export const SSO_AUTH_REQUEST_REPOSITORY = Symbol(
    'SSO_AUTH_REQUEST_REPOSITORY'
);
