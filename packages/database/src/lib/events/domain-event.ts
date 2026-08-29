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
 * What kind of principal an {@link EventActor} names.
 *
 * The distinction exists because an audit row's `actor_id` used to mean exactly
 * one thing — a `users` row — and a write made with an API token therefore had
 * to pass no actor at all rather than name a person who did not do it. That
 * left every token-authenticated write attributed to "System", including every
 * write over the public REST API, GraphQL and MCP. Naming the kind alongside
 * the id is what lets a token be the actor without the id changing meaning.
 */
export const EVENT_ACTOR_TYPE = {
    /** A signed-in person; `id` is a `users` row id. */
    User: 'user',
    /** An external API credential; `id` is an `api_tokens` row id. */
    ApiToken: 'api_token'
} as const;

/** What kind of principal an {@link EventActor} names. */
export type EventActorType =
    (typeof EVENT_ACTOR_TYPE)[keyof typeof EVENT_ACTOR_TYPE];

/**
 * The acting principal carried on an audited event's payload — the "who did it"
 * an audit subscriber needs but the aggregate does not know. Held in the
 * payload (the only part of the envelope that survives the outbox round-trip)
 * under a standard `actor` key by {@link attachActor}.
 */
export interface EventActor {
    /** The actor's id. */
    id: string;
    /** The actor's email snapshot, or `null` when unknown. */
    email: string | null;
    /**
     * What kind of principal `id` names. Omitted means
     * {@link EVENT_ACTOR_TYPE.User} — every caller predating token attribution
     * passed a person, so the default keeps their rows reading exactly as
     * before.
     */
    type?: EventActorType;
    /**
     * A human label for an actor that is not a person, e.g. an API token's
     * name. `email` is the label for a user and a token has none, so without
     * this a token-actored row would show an id and nothing readable.
     */
    label?: string | null;
}

/**
 * Returns copies of `events` with the acting principal merged into each payload
 * under a standard `actor` key. Use it in an application service — the layer
 * that knows the request's actor — right before appending an aggregate's
 * pulled events to the outbox, so a downstream audit subscriber can recover
 * `actorId`/`actorEmail` from an event alone. Leaves the rest of the payload
 * untouched and never mutates the inputs.
 */
export function attachActor(
    events: DomainEvent[],
    actor: EventActor
): DomainEvent[] {
    return events.map((event) => ({
        ...event,
        payload: {
            ...event.payload,
            actor: {
                id: actor.id,
                email: actor.email,
                type: actor.type ?? EVENT_ACTOR_TYPE.User,
                label: actor.label ?? null
            }
        }
    }));
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
