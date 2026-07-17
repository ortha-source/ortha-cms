import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '../events/domain-event';
import { outboxEvents } from '../schema/outbox-events';
import { UnitOfWork } from '../uow/unit-of-work';

/**
 * Persists domain events into the transactional outbox. Because it uses
 * {@link UnitOfWork.current} as the executor, the insert runs in the **same**
 * transaction as the state change that produced the events — so the events
 * commit atomically with (and never without) that change.
 */
@Injectable()
export class OutboxWriter {
    constructor(private readonly uow: UnitOfWork) {}

    /**
     * Appends `events` to the outbox as undispatched rows (`dispatchedAt`
     * null, `attempts` 0). Call from inside a {@link UnitOfWork.run} so the
     * write joins the active transaction; a no-op when `events` is empty.
     */
    async append(events: DomainEvent[]): Promise<void> {
        if (events.length === 0) {
            return;
        }

        await this.uow
            .current()
            .insert(outboxEvents)
            .values(
                events.map((event) => ({
                    id: event.eventId,
                    kind: event.kind,
                    aggregateType: event.aggregateType,
                    aggregateId: event.aggregateId,
                    payload: event.payload,
                    occurredAt: event.occurredAt,
                    dispatchedAt: null,
                    attempts: 0
                }))
            );
    }
}
