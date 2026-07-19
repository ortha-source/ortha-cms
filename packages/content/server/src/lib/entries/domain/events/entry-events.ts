import { createDomainEvent, type DomainEvent } from '@ortha-cms/database';

/**
 * The domain-event kinds the {@link Entry} publish lifecycle raises — one per
 * status transition, as dotted names. A Wave-3 outbox subscriber will turn
 * these into the content activity log; the kinds are chosen so that move needs
 * no data change.
 */
export const ENTRY_EVENT_KINDS = {
    PUBLISHED: 'entry.published',
    UNPUBLISHED: 'entry.unpublished'
} as const;

/** The aggregate type stamped on every entry domain event. */
const AGGREGATE_TYPE = 'content_entry';

/**
 * Builds an entry {@link DomainEvent} of `kind` for `entryId`, carrying
 * `payload`. Keeps the domain model free of the event envelope's plumbing — the
 * model names the fact and its data; this stamps the `aggregateType`/id.
 */
export function entryEvent(
    kind: string,
    entryId: string,
    payload: Record<string, unknown>
): DomainEvent {
    return createDomainEvent({
        kind,
        aggregateType: AGGREGATE_TYPE,
        aggregateId: entryId,
        payload
    });
}
