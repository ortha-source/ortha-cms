import { createDomainEvent, type DomainEvent } from '@ortha-cms/database';

/**
 * The domain event kinds the {@link Member} aggregate raises — one per primary
 * lifecycle transition, as dotted names.
 *
 * Note these `member.*` kinds are **distinct** from the `user.*` audit kinds
 * ({@link USER_ACTIVITY_KINDS}) the activity recorder writes in-band. Unlike the
 * workspaces pilot (whose event kinds mirror its audit kinds one-to-one), the
 * users context keeps the two catalogues separate, so Wave 3's move of auditing
 * onto an outbox subscriber will map `member.*` → `user.*` rather than reuse the
 * same strings.
 */
export const MEMBER_EVENT_KINDS = {
    INVITED: 'member.invited',
    ROLE_CHANGED: 'member.role_changed',
    DISABLED: 'member.disabled',
    REMOVED: 'member.removed'
} as const;

/** The aggregate type stamped on every member domain event. */
const AGGREGATE_TYPE = 'member';

/**
 * Builds a member {@link DomainEvent} of `kind` for `memberId`, carrying
 * `payload`. Keeps the aggregate free of the event envelope's plumbing — the
 * aggregate names the fact and its data; this stamps the `aggregateType`/id.
 */
export function memberEvent(
    kind: string,
    memberId: string,
    payload: Record<string, unknown>
): DomainEvent {
    return createDomainEvent({
        kind,
        aggregateType: AGGREGATE_TYPE,
        aggregateId: memberId,
        payload
    });
}
