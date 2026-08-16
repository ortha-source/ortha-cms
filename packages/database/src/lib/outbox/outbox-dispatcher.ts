import {
    Inject,
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type OnModuleDestroy
} from '@nestjs/common';
import { and, eq, isNull, lt, lte, or } from 'drizzle-orm';
import type { Database } from '../types';
import { InjectDatabase } from '../database.tokens';
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
 * How many failed deliveries a row gets before the drain stops claiming it.
 *
 * Without a ceiling, `attempts` is written and never read: a row whose
 * subscriber can never succeed is re-selected on every tick forever, and
 * because the claim is `ORDER BY occurred_at LIMIT 100`, a full batch of such
 * rows sits permanently at the head of the queue and no newer event is ever
 * delivered again. Parking the row at the cap leaves it in the table —
 * `dispatched_at IS NULL AND attempts >= MAX_DELIVERY_ATTEMPTS` is the
 * dead-letter query — and lets the queue behind it move. An operator who has
 * fixed the cause replays a parked row by clearing `attempts`.
 *
 * Paired with {@link nextAttemptAfter}: the count only bounds anything because
 * each attempt is spaced out, so 15 of them is about half an hour, not fifteen
 * consecutive drains.
 */
export const MAX_DELIVERY_ATTEMPTS = 15;

/** Delay before the first retry; doubles with each further failure. */
const RETRY_BASE_DELAY_MS = 1_000;

/** Ceiling on the retry delay, so the backoff plateaus instead of running away. */
const RETRY_MAX_DELAY_MS = 5 * 60_000;

/**
 * When a row that has now failed `attempts` times may be claimed again.
 *
 * The delay is what makes {@link MAX_DELIVERY_ATTEMPTS} mean something. Drains
 * are triggered by commits, so on a busy server they run back to back: an
 * attempt ceiling with no delay would be spent in milliseconds, and a
 * subscriber that was merely unreachable for a moment would have every one of
 * its events parked before it came back. Doubling from a second and plateauing
 * at five minutes gives roughly a half-hour window before a row is treated as
 * a dead letter.
 */
export function nextAttemptAfter(attempts: number, now: Date): Date {
    const delay = Math.min(
        RETRY_BASE_DELAY_MS * 2 ** (attempts - 1),
        RETRY_MAX_DELAY_MS
    );
    return new Date(now.getTime() + delay);
}

/**
 * Drains the transactional outbox and delivers each event to its
 * subscribers. Two triggers feed it: {@link UnitOfWork} calls
 * {@link drain} right after a unit of work commits (the fast path), and a
 * lightweight poll backstop drains on an interval so nothing is stranded
 * if that post-commit call is lost (crash, swallowed error).
 *
 * **Delivery is at-least-once** — subscribers must be idempotent. A drain
 * claims pending rows `FOR UPDATE SKIP LOCKED`, so drains in **different
 * processes** take disjoint rows and never block each other. Within one
 * process {@link drain} runs them one at a time on purpose: they compete for
 * the same pool, and a drain holds a client for its whole batch while the
 * subscribers it calls need clients of their own.
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

    /** The drain currently executing, or null when none is. */
    private active: Promise<void> | null = null;

    /** The drain waiting to start behind {@link active}, if one is queued. */
    private queued: Promise<void> | null = null;

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
     * Drains the outbox, **one drain at a time per process**.
     *
     * A drain holds a pool client for its whole batch, and every subscriber it
     * calls acquires a client of its own. Run enough drains at once and the
     * pool is held entirely by drains that are each waiting for a client that
     * can never be freed — a deadlock with no timeout, no log and no recovery,
     * reachable from a dozen concurrent requests over an outbox backlog. So
     * concurrent callers are collapsed instead: the one in flight is left
     * alone, and everyone who arrives while it runs joins a **single** queued
     * drain. That drain starts after every one of those callers committed, so
     * each still gets the guarantee it came for — its rows are drained before
     * its `await` returns — without a drain per caller.
     *
     * @see drainOnce for what a single drain does.
     */
    async drain(): Promise<void> {
        if (this.queued) {
            return this.queued;
        }
        if (!this.active) {
            return this.startDrain();
        }
        this.queued = this.active.then(
            () => this.promoteQueued(),
            () => this.promoteQueued()
        );
        return this.queued;
    }

    /** The queued drain's turn has come: it becomes the active one. */
    private promoteQueued(): Promise<void> {
        this.queued = null;
        return this.startDrain();
    }

    /** Runs one drain and tracks it as {@link active} until it settles. */
    private startDrain(): Promise<void> {
        const run = this.drainOnce();
        const settled = run.then(
            () => undefined,
            () => undefined
        );
        this.active = settled;
        void settled.then(() => {
            // Only clear if a later drain has not already claimed the slot.
            if (this.active === settled) {
                this.active = null;
            }
        });
        return run;
    }

    /**
     * Claims up to {@link DRAIN_BATCH_SIZE} undispatched events in a
     * transaction (`FOR UPDATE SKIP LOCKED`, oldest first) and delivers each
     * to every matching subscriber. On full success a row is stamped
     * `dispatchedAt`; if a subscriber throws, that row's `attempts` is
     * incremented and it stays undispatched for a later retry — one bad
     * subscriber never blocks other events. A row that has already failed
     * {@link MAX_DELIVERY_ATTEMPTS} times is no longer claimed at all, so it
     * cannot hold the head of the queue against every event behind it.
     */
    private async drainOnce(): Promise<void> {
        await this.db.transaction(async (tx) => {
            const rows = await tx
                .select()
                .from(outboxEvents)
                .where(
                    and(
                        isNull(outboxEvents.dispatchedAt),
                        lt(outboxEvents.attempts, MAX_DELIVERY_ATTEMPTS),
                        or(
                            isNull(outboxEvents.nextAttemptAt),
                            lte(outboxEvents.nextAttemptAt, new Date())
                        )
                    )
                )
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
                    const attempts = row.attempts + 1;
                    this.logger.error(
                        attempts >= MAX_DELIVERY_ATTEMPTS
                            ? `Delivery failed for event ${row.id} (${row.kind}) ` +
                              `${attempts} times; giving up. The row stays in ` +
                              `outbox_events undispatched and is no longer claimed — ` +
                              `query dispatched_at IS NULL AND attempts >= ` +
                              `${MAX_DELIVERY_ATTEMPTS} for the dead letters.`
                            : `Delivery failed for event ${row.id} (${row.kind}); will retry`,
                        error instanceof Error ? error.stack : String(error)
                    );
                    await tx
                        .update(outboxEvents)
                        .set({
                            attempts,
                            nextAttemptAt: nextAttemptAfter(
                                attempts,
                                new Date()
                            )
                        })
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
