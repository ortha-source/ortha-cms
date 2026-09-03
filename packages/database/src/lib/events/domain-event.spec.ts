import { attachActor, createDomainEvent } from './domain-event';

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createDomainEvent', () => {
    it('fills the identity and the time the caller left out', () => {
        const before = Date.now();
        const event = createDomainEvent({
            kind: 'workspace.created',
            aggregateType: 'workspace',
            aggregateId: 'w1',
            payload: { name: 'Acme' }
        });

        expect(event.eventId).toMatch(UUID_V4);
        expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
        expect(event.payload).toEqual({ name: 'Acme' });
    });

    it('keeps an explicit eventId and occurredAt verbatim', () => {
        const eventId = '00000000-0000-4000-8000-000000000001';
        const occurredAt = new Date('2020-01-02T03:04:05.000Z');

        const event = createDomainEvent({
            eventId,
            occurredAt,
            kind: 'workspace.created',
            aggregateType: 'workspace',
            aggregateId: 'w1',
            payload: {}
        });

        expect(event.eventId).toBe(eventId);
        expect(event.occurredAt).toBe(occurredAt);
    });

    it('mints a fresh id per event', () => {
        const ids = Array.from({ length: 50 }, () =>
            createDomainEvent({
                kind: 'k',
                aggregateType: 'a',
                aggregateId: '1',
                payload: {}
            })
        ).map((event) => event.eventId);

        expect(new Set(ids).size).toBe(50);
    });
});

describe('attachActor', () => {
    const source = () => [
        createDomainEvent({
            kind: 'workspace.created',
            aggregateType: 'workspace',
            aggregateId: 'w1',
            payload: { name: 'Acme' }
        })
    ];

    it('merges the actor into each payload without touching the inputs [database:I-22]', () => {
        const events = source();
        const snapshot = JSON.parse(JSON.stringify(events[0].payload));

        const enriched = attachActor(events, {
            id: 'u1',
            email: 'admin@example.com'
        });

        expect(enriched[0].payload).toEqual({
            name: 'Acme',
            // `type` defaults to `user` and `label` to null: an actor that says
            // nothing about its kind is a person, because until API tokens
            // could be actors nothing else was one.
            actor: {
                id: 'u1',
                email: 'admin@example.com',
                type: 'user',
                label: null,
                via: null
            }
        });
        // The producer keeps its own events: the aggregate that pulled them has
        // no idea an actor was ever added.
        expect(events[0].payload).toEqual(snapshot);
        expect(enriched).not.toBe(events);
        expect(enriched[0]).not.toBe(events[0]);
    });

    it('carries a null email through rather than dropping the key', () => {
        const enriched = attachActor(source(), { id: 'u1', email: null });

        expect(enriched[0].payload.actor).toEqual({
            id: 'u1',
            email: null,
            type: 'user',
            label: null,
            via: null
        });
    });

    it('leaves the rest of the envelope alone', () => {
        const [original] = source();
        const [enriched] = attachActor([original], {
            id: 'u1',
            email: null
        });

        expect(enriched.eventId).toBe(original.eventId);
        expect(enriched.kind).toBe(original.kind);
        expect(enriched.aggregateType).toBe(original.aggregateType);
        expect(enriched.aggregateId).toBe(original.aggregateId);
        expect(enriched.occurredAt).toBe(original.occurredAt);
    });

    it('overwrites an actor a producer had already put on the payload [database:I-22]', () => {
        const events = [
            createDomainEvent({
                kind: 'k',
                aggregateType: 'a',
                aggregateId: '1',
                payload: { actor: 'set by the producer' }
            })
        ];

        const enriched = attachActor(events, { id: 'u1', email: null });

        // The application layer's actor wins — worth stating, because it means
        // `actor` is a reserved key a producer cannot use for anything else.
        expect(enriched[0].payload.actor).toEqual({
            id: 'u1',
            email: null,
            type: 'user',
            label: null,
            via: null
        });
    });

    it('carries a token actor as itself, with its label', () => {
        const enriched = attachActor(source(), {
            id: 't1',
            email: null,
            type: 'api_token',
            label: 'Deploy bot',
            via: null
        });

        // The whole point of the field: `id` is an `api_tokens` row here, not a
        // `users` one, and a consumer has to be able to tell.
        expect(enriched[0].payload.actor).toEqual({
            id: 't1',
            email: null,
            type: 'api_token',
            label: 'Deploy bot',
            via: null
        });
    });

    it('carries `via` — how the actor performed it, not who they are', () => {
        const enriched = attachActor(source(), {
            id: 'u1',
            email: 'ada@example.com',
            via: { kind: 'copilot', runId: 'r1', proposalId: 'p1' }
        });

        // The actor stays the human; `via` is what stops a copilot-applied
        // change reading as one they typed.
        expect(enriched[0].payload.actor).toEqual({
            id: 'u1',
            email: 'ada@example.com',
            type: 'user',
            label: null,
            via: { kind: 'copilot', runId: 'r1', proposalId: 'p1' }
        });
    });

    it('returns an empty array for an empty array', () => {
        expect(attachActor([], { id: 'u1', email: null })).toEqual([]);
    });
});
