import {
    Inject,
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type OnModuleDestroy
} from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import type { Database } from '../types';
import { InjectDatabase } from '../database.module';
import {
    DOMAIN_EVENT_SUBSCRIBERS,
    type DomainEvent,
    type DomainEventSubscriber
} from '../events/domain-event';
import { outboxEvents } from '../schema/outbox-events';

/** How many pending events a single drain claims and delivers. */
const DRAIN_BATCH_SIZE = 100;

/** How often the poll backstop drains, in milliseconds. */
const POLL_INTERVAL_MS = 5_000;

/**
 * Drains the transactional outbox and delivers each event to its
 * subscribers. Two triggers feed it: {@link UnitOfWork} calls
 * {@link drain} right after a unit of work commits (the fast path), and a
 * lightweight poll backstop drains on an interval so nothing is stranded
 * if that post-commit call is lost (crash, swallowed error).
 *
 * **Delivery is at-least-once** — subscribers must be idempotent. A drain
 * claims pending rows `FOR UPDATE SKIP LOCKED`, so concurrent drains (poll
 * vs. post-commit, or multiple instances) take disjoint rows and never
 * block each other.
 */
@Injectable()
export class OutboxDispatcher
    implements OnApplicationBootstrap, OnModuleDestroy
{
    private readonly logger = new Logger(OutboxDispatcher.name);

    /** Subscribers registered at runtime via {@link register}. */
    private readonly registered: DomainEventSubscriber[] = [];

    /** Guards the poll backstop against overlapping runs. */
    private draining = false;

    /** The poll backstop's interval handle; null until bootstrap. */
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        @InjectDatabase() private readonly db: Database,
        @Inject(DOMAIN_EVENT_SUBSCRIBERS)
        private readonly injectedSubscribers: DomainEventSubscriber[]
    ) {}

    /**
     * Registers a subscriber at runtime. This is the mechanism downstream
     * plugins use: from their own `OnApplicationBootstrap`, inject the
     * dispatcher and call `register(...)`. Prefer this over the
     * {@link DOMAIN_EVENT_SUBSCRIBERS} multi-provider, which Nest cannot
     * merge across independent dynamic modules.
     */
    register(subscriber: DomainEventSubscriber): void {
        this.registered.push(subscriber);
    }

    /**
     * Claims up to {@link DRAIN_BATCH_SIZE} undispatched events in a
     * transaction (`FOR UPDATE SKIP LOCKED`, oldest first) and delivers each
     * to every matching subscriber. On full success a row is stamped
     * `dispatchedAt`; if a subscriber throws, that row's `attempts` is
     * incremented and it stays undispatched for a later retry — one bad
     * subscriber never blocks other events.
     */
    async drain(): Promise<void> {
        await this.db.transaction(async (tx) => {
            const rows = await tx
                .select()
                .from(outboxEvents)
                .where(isNull(outboxEvents.dispatchedAt))
                .orderBy(outboxEvents.occurredAt)
                .limit(DRAIN_BATCH_SIZE)
                .for('update', { skipLocked: true });

            for (const row of rows) {
                const event: DomainEvent = {
                    eventId: row.id,
                    kind: row.kind,
                    aggregateType: row.aggregateType,
                    aggregateId: row.aggregateId,
                    occurredAt: row.occurredAt,
                    payload: row.payload as Record<string, unknown>
                };

                try {
                    for (const subscriber of this.subscribersFor(row.kind)) {
                        await subscriber.handle(event);
                    }
                    await tx
                        .update(outboxEvents)
                        .set({ dispatchedAt: new Date() })
                        .where(eq(outboxEvents.id, row.id));
                } catch (error) {
                    this.logger.error(
                        `Delivery failed for event ${row.id} (${row.kind}); will retry`,
                        error instanceof Error ? error.stack : String(error)
                    );
                    await tx
                        .update(outboxEvents)
                        .set({ attempts: row.attempts + 1 })
                        .where(eq(outboxEvents.id, row.id));
                }
            }
        });
    }

    /** Starts the poll backstop once the app is up. */
    onApplicationBootstrap(): void {
        this.timer = setInterval(() => {
            void this.pollOnce();
        }, POLL_INTERVAL_MS);
        // Don't let the backstop keep the process alive on shutdown.
        this.timer.unref();
    }

    /** Stops the poll backstop on teardown. */
    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** One guarded poll tick — skips if a drain is already running. */
    private async pollOnce(): Promise<void> {
        if (this.draining) {
            return;
        }
        this.draining = true;
        try {
            await this.drain();
        } catch (error) {
            this.logger.error(
                'Outbox poll drain failed',
                error instanceof Error ? error.stack : String(error)
            );
        } finally {
            this.draining = false;
        }
    }

    /** All subscribers (injected + runtime-registered) that want `kind`. */
    private subscribersFor(kind: string): DomainEventSubscriber[] {
        return [...this.injectedSubscribers, ...this.registered].filter(
            (subscriber) =>
                subscriber.kinds === '*' || subscriber.kinds.includes(kind)
        );
    }
}
