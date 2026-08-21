import { createDomainEvent, type DomainEvent } from '@orthacms/database';

/**
 * The domain-event kinds an entry's lifecycle raises, as dotted names.
 *
 * Two of them — `entry.published` / `entry.unpublished` — are **status
 * transitions** and are raised by the {@link Entry} model, which owns the
 * `draft ↔ published` invariants. The rest are the ordinary editing lifecycle:
 * a row appearing, its values changing, it going to the trash, coming back, or
 * being destroyed. Those carry no invariant of their own — nothing about
 * "created" can be violated — so they are minted by the builders below and
 * raised by the write path directly, rather than by fabricating an aggregate
 * (and a publish status a non-publishable type does not have) around a fact.
 *
 * Until this set existed the audit log could answer "who did what, when" for
 * accounts, workspaces, API tokens, the media library and content **publishes**
 * — and not for the single most frequent action in a CMS. An editor could
 * create, rewrite and delete every entry in the product and the log stayed
 * silent, because there was nothing on the outbox for a subscriber to consume.
 */
export const ENTRY_EVENT_KINDS = {
    CREATED: 'entry.created',
    UPDATED: 'entry.updated',
    PUBLISHED: 'entry.published',
    UNPUBLISHED: 'entry.unpublished',
    DELETED: 'entry.deleted',
    RESTORED: 'entry.restored',
    PURGED: 'entry.purged'
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

/** A new entry exists. `contentType` is what lets the log name *what* was made. */
export function entryCreated(
    entryId: string,
    contentType: string
): DomainEvent {
    return entryEvent(ENTRY_EVENT_KINDS.CREATED, entryId, { contentType });
}

/**
 * An entry's stored values changed, naming **which fields** did.
 *
 * The field list is the `workspace.updated` precedent (`{ fields }`), and it is
 * what makes a row worth reading: "Ada edited Article X" is a fact, "Ada edited
 * the title and body of Article X" is a review. It is computed by comparing the
 * stored row against the written one, which also answers the volume question
 * this event raises — a save that changes nothing (a re-submit, a reopened
 * editor, a restore of the version already live) produces **no** field names
 * and therefore no event at all, so the log records editorial changes rather
 * than round trips.
 */
export function entryUpdated(
    entryId: string,
    contentType: string,
    fields: readonly string[]
): DomainEvent {
    return entryEvent(ENTRY_EVENT_KINDS.UPDATED, entryId, {
        contentType,
        fields: [...fields]
    });
}

/**
 * An entry was deleted. `soft` distinguishes the two very different facts the
 * one route produces: a **paranoid** type is tombstoned and can be restored,
 * while any other type is gone from the table the moment this commits, and a
 * reviewer reading the log needs to know which happened.
 */
export function entryDeleted(
    entryId: string,
    contentType: string,
    soft: boolean
): DomainEvent {
    return entryEvent(ENTRY_EVENT_KINDS.DELETED, entryId, {
        contentType,
        soft
    });
}

/** A soft-deleted entry's tombstone was cleared. */
export function entryRestored(
    entryId: string,
    contentType: string
): DomainEvent {
    return entryEvent(ENTRY_EVENT_KINDS.RESTORED, entryId, { contentType });
}

/**
 * A tombstoned entry was destroyed permanently.
 *
 * Its own kind rather than a second `entry.deleted`: this is the one content
 * action with nothing left behind to inspect afterwards, so it is exactly the
 * one an audit trail has to record distinctly.
 */
export function entryPurged(entryId: string, contentType: string): DomainEvent {
    return entryEvent(ENTRY_EVENT_KINDS.PURGED, entryId, { contentType });
}
