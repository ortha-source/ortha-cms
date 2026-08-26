import {
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type OnModuleDestroy
} from '@nestjs/common';
import { InjectAlarmsConfig } from '../alarms.tokens';
import type { ResolvedAlarmsConfig } from '../types/alarms-config';
import { AlarmEvaluator } from './alarm-evaluator.service';
import { AlarmRuleRepository } from './alarm-rule.repository';

/**
 * Periodically re-runs every active rule.
 *
 * **Why a sweep exists at all.** The event path covers everything an editor
 * does, but a whole class of rule describes what an editor has *not* done —
 * "published and not updated in 90 days", "a draft that has sat for a month".
 * By construction nobody is touching those entries, so no `entry.updated` will
 * ever arrive to re-evaluate them, and without a periodic pass such a rule
 * would only ever fire on rows that happened to be edited for other reasons.
 *
 * **Why an interval and not a scheduler.** The repository has no scheduler and
 * adding one for this is a dependency and a deployment concern for a single
 * timer. `OutboxDispatcher` sets the precedent: a plain interval in-process,
 * with the work behind it made idempotent so that several API processes running
 * it simply means it happens more often than configured. That is a real
 * trade-off rather than a free lunch — the sweep is per-process, so it is not
 * the right mechanism for anything that must happen exactly once.
 *
 * The first sweep is deliberately delayed by one interval: boot is the worst
 * moment to start scanning collections, and nothing is more stale one minute
 * after start-up than it was one minute before.
 */
@Injectable()
export class AlarmSweepService
    implements OnApplicationBootstrap, OnModuleDestroy
{
    private readonly logger = new Logger(AlarmSweepService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    /** The sweep in flight, so shutdown can wait for it. */
    private running: Promise<void> | null = null;
    private stopped = false;

    constructor(
        private readonly rules: AlarmRuleRepository,
        private readonly evaluator: AlarmEvaluator,
        @InjectAlarmsConfig() private readonly config: ResolvedAlarmsConfig
    ) {}

    /** Arms the interval, unless sweeping is switched off. */
    onApplicationBootstrap(): void {
        const minutes = this.config.sweepIntervalMinutes;
        if (minutes <= 0) return;
        this.timer = setInterval(() => void this.sweep(), minutes * 60 * 1000);
        // Never hold the process open for a periodic rescan.
        this.timer.unref?.();
    }

    /**
     * Clears the timer and waits for a sweep already in flight.
     *
     * Waiting matters even though the work is idempotent: a scan interrupted
     * mid-rule has reconciled some of its batches and not others, so its
     * findings describe neither the old state nor the new one until something
     * runs again.
     */
    async onModuleDestroy(): Promise<void> {
        this.stopped = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.running) await this.running;
    }

    /**
     * Rescans every active rule, one at a time.
     *
     * Serial on purpose: a scan reads whole collections, and running twenty of
     * them at once would turn a background hygiene task into the heaviest thing
     * the database is doing. Concurrent callers collapse onto the sweep already
     * running rather than starting a second one.
     */
    async sweep(): Promise<void> {
        if (this.running) return this.running;
        this.running = this.runSweep().finally(() => {
            this.running = null;
        });
        return this.running;
    }

    private async runSweep(): Promise<void> {
        const rules = await this.rules.allActive();
        for (const rule of rules) {
            if (this.stopped) return;
            try {
                await this.evaluator.rescan(rule);
            } catch (error) {
                // One rule's failure must not end the sweep — the remaining
                // rules are unrelated and their findings would silently stop
                // being refreshed.
                this.logger.warn(
                    `Sweep of rule "${rule.name}" (${rule.id}) failed: ` +
                        `${(error as Error).message}`
                );
            }
        }
    }
}
