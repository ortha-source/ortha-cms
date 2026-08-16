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

        if (!this.uow.isActive()) {
            // Outside a unit of work `uow.current()` is the base pool, so this
            // insert would auto-commit on its own connection — the event would
            // survive a state change that rolled back, which is the exact
            // failure the outbox pattern exists to prevent. It used to happen
            // silently; there is no case where it is what the caller meant.
            throw new Error(
                'OutboxWriter.append must be called inside UnitOfWork.run(...) — ' +
                    'appending outside a unit of work commits the events on their own ' +
                    'connection, so they can outlive a rolled-back state change.'
            );
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
