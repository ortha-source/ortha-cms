import { createDomainEvent, type DomainEvent } from '@ortha-cms/database';

/**
 * The domain event kinds the identity context raises. Two families:
 *
 * - `user.*` — {@link UserAccount} lifecycle/credential facts, raised by the
 *   aggregate;
 * - `auth.*` — session facts (sign-in / sign-out), raised by the auth
 *   use-cases (a sign-in mutates no `UserAccount`, so its fact is minted by the
 *   flow rather than drained from an aggregate).
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
    SIGNED_OUT: 'auth.signed_out'
} as const;

/** A domain event kind raised by the identity context. */
export type IdentityEventKind =
    (typeof IDENTITY_EVENT_KINDS)[keyof typeof IDENTITY_EVENT_KINDS];

/** The aggregate type stamped on every identity domain event. */
const AGGREGATE_TYPE = 'user';

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
