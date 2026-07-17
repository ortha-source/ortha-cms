import { randomUUID } from 'node:crypto';

/**
 * The envelope every bounded context uses to publish a fact about a
 * state change. Framework-free by design — it carries no NestJS, no
 * Drizzle, no transport concern, so any layer can construct one.
 */
export interface DomainEvent {
    /** Stable unique id (uuid) — the idempotency key for at-least-once delivery. */
    eventId: string;
    /** What happened, as a dotted name, e.g. `'workspace.created'`. */
    kind: string;
    /** The aggregate root's type, e.g. `'workspace'`. */
    aggregateType: string;
    /** The aggregate root's id the event concerns. */
    aggregateId: string;
    /** When the fact occurred (domain time, not dispatch time). */
    occurredAt: Date;
    /** Event-specific data. Must be JSON-serializable — it is stored as jsonb. */
    payload: Record<string, unknown>;
}

/**
 * Parameters for {@link createDomainEvent}. `eventId` and `occurredAt` are
 * optional — the helper fills them when omitted.
 */
export interface CreateDomainEventParams {
    /** Overrides the generated uuid. Omit to let the helper generate one. */
    eventId?: string;
    /** What happened, as a dotted name, e.g. `'workspace.created'`. */
    kind: string;
    /** The aggregate root's type, e.g. `'workspace'`. */
    aggregateType: string;
    /** The aggregate root's id the event concerns. */
    aggregateId: string;
    /** When the fact occurred. Defaults to `new Date()` when omitted. */
    occurredAt?: Date;
    /** Event-specific, JSON-serializable data. */
    payload: Record<string, unknown>;
}

/**
 * Builds a {@link DomainEvent}, filling `eventId` (a fresh uuid) and
 * `occurredAt` (now) when the caller omits them. Keep this the one way
 * domain code mints events so the envelope stays consistent.
 */
export function createDomainEvent(
    params: CreateDomainEventParams
): DomainEvent {
    return {
        eventId: params.eventId ?? randomUUID(),
        kind: params.kind,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        occurredAt: params.occurredAt ?? new Date(),
        payload: params.payload
    };
}

/**
 * A downstream reactor to domain events. Registered with the
 * `OutboxDispatcher`, which delivers each drained event to every
 * subscriber whose {@link kinds} matches.
 *
 * **Delivery is at-least-once** — a subscriber may see the same event
 * more than once (retry after a partial failure, or an overlapping
 * drain). Implementations **must be idempotent**.
 */
export interface DomainEventSubscriber {
    /**
     * The event kinds this subscriber wants — an explicit allow-list, or
     * `'*'` to receive every kind.
     */
    readonly kinds: readonly string[] | '*';
    /** Handles one delivered event. Must be idempotent (see the interface note). */
    handle(event: DomainEvent): Promise<void>;
}

/**
 * DI token for the array of statically-provided {@link DomainEventSubscriber}s.
 * Defaults to an empty array so injection never fails before any plugin
 * contributes one. Plugins that register at runtime instead call
 * `OutboxDispatcher.register(...)`.
 */
export const DOMAIN_EVENT_SUBSCRIBERS = Symbol('DOMAIN_EVENT_SUBSCRIBERS');
