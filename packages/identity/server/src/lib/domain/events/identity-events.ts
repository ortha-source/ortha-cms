import { createDomainEvent, type DomainEvent } from '@orthacms/database';

/**
 * The domain event kinds the identity context raises. Three families:
 *
 * - `user.*` — {@link UserAccount} lifecycle/credential facts, raised by the
 *   aggregate;
 * - `auth.*` — session facts (sign-in / sign-out), raised by the auth
 *   use-cases (a sign-in mutates no `UserAccount`, so its fact is minted by the
 *   flow rather than drained from an aggregate);
 * - `api_token.*` — external-API bearer token lifecycle, raised by
 *   `ApiTokenService`. Their aggregate is the **token**, not a user, so they are
 *   built with {@link apiTokenEvent}.
 *
 * These are **distinct** from the `user.*` audit kinds
 * ({@link IDENTITY_ACTIVITY_KINDS}) the activity recorder writes in-band: like
 * the users context, the two catalogues are kept separate, so Wave 3's move of
 * auditing onto an outbox subscriber maps between them rather than reusing the
 * same strings. Emitting these to the outbox is harmless until that subscriber
 * exists (no subscriber ⇒ the rows auto-mark dispatched).
 */
export const IDENTITY_EVENT_KINDS = {
    USER_ACTIVATED: 'user.activated',
    USER_DISABLED: 'user.disabled',
    USER_ENABLED: 'user.enabled',
    PASSWORD_CHANGED: 'user.password_changed',
    SIGNED_IN: 'auth.signed_in',
    SIGNED_OUT: 'auth.signed_out',
    /**
     * An identity provider's subject was linked to an account. Raised once per
     * link, not per sign-in — the interesting fact is that a second way into
     * the account now exists.
     */
    SSO_LINKED: 'user.sso_linked',
    /**
     * An account was created from a verified profile, with no invite and no
     * password. This is the one SSO fact a security review will look for
     * first, because it is the only path in this product that produces an
     * account nobody explicitly invited.
     */
    SSO_PROVISIONED: 'user.sso_provisioned',
    /**
     * A role-mapping handler moved an account to a different role. Raised only
     * when the role actually changed, so an unchanged mapping does not write a
     * row on every sign-in for the rest of the account's life.
     */
    SSO_ROLE_MAPPED: 'user.sso_role_mapped',
    API_TOKEN_CREATED: 'api_token.created',
    API_TOKEN_REVOKED: 'api_token.revoked'
} as const;

/** A domain event kind raised by the identity context. */
export type IdentityEventKind =
    (typeof IDENTITY_EVENT_KINDS)[keyof typeof IDENTITY_EVENT_KINDS];

/** The aggregate type stamped on identity's `user.*` / `auth.*` events. */
const AGGREGATE_TYPE = 'user';

/** The aggregate type stamped on identity's `api_token.*` events. */
const API_TOKEN_AGGREGATE_TYPE = 'api_token';

/**
 * Builds an identity {@link DomainEvent} of `kind` for `userId`, carrying
 * `payload`. Keeps aggregates and use-cases free of the event envelope's
 * plumbing — the caller names the fact and its data; this stamps the
 * `aggregateType`/id.
 */
export function identityEvent(
    kind: string,
    userId: string,
    payload: Record<string, unknown> = {}
): DomainEvent {
    return createDomainEvent({
        kind,
        aggregateType: AGGREGATE_TYPE,
        aggregateId: userId,
        payload
    });
}

/**
 * Builds an identity {@link DomainEvent} of `kind` for the API token `tokenId`,
 * carrying `payload`. The sibling of {@link identityEvent} for the one identity
 * concern whose aggregate is not a user: an API token has its own lifecycle
 * (minted, revoked) and its own id, and the acting admin rides on the payload
 * as the actor rather than being the subject.
 *
 * `payload` must never carry the token's plaintext or its hash — the audit log
 * is a lower-trust store than `api_tokens`, and the whole point of hashing at
 * rest is that a read of another table yields no usable credential. The
 * non-secret `lookupPrefix` is what identifies a token in a log line.
 */
export function apiTokenEvent(
    kind: string,
    tokenId: string,
    payload: Record<string, unknown> = {}
): DomainEvent {
    return createDomainEvent({
        kind,
        aggregateType: API_TOKEN_AGGREGATE_TYPE,
        aggregateId: tokenId,
        payload
    });
}
