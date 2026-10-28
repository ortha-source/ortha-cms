import {
    Inject,
    Injectable,
    Logger,
    Optional,
    type OnApplicationBootstrap,
    type OnModuleDestroy
} from '@nestjs/common';
import { UnitOfWork } from '@orthacms/database';
import {
    InjectContentRegistry,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import {
    NOTIFICATION_DISPATCHER,
    NOTIFICATION_KINDS,
    type AlarmDigestSection,
    type NotificationDispatcher
} from '@orthacms/mail-domain';
import { InjectAlarmsConfig } from '../alarms.tokens';
import type { ResolvedAlarmsConfig } from '../types/alarms-config';
import {
    AlarmDigestRepository,
    type DigestFrequency,
    type DigestRecipient
} from '../infrastructure/alarm-digest.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-10-28` — the UTC day a moment falls on. */
function utcDay(at: Date): string {
    return at.toISOString().slice(0, 10);
}

/**
 * The period a digest at `now` belongs to, or `null` when this frequency
 * sends nothing now: daily every day, weekly on Mondays (UTC), off never.
 */
export function digestPeriod(
    frequency: DigestFrequency,
    now: Date
): { key: string; lengthMs: number } | null {
    if (frequency === 'daily') return { key: utcDay(now), lengthMs: DAY_MS };
    if (frequency === 'weekly' && now.getUTCDay() === 1) {
        return { key: `week-${utcDay(now)}`, lengthMs: 7 * DAY_MS };
    }
    return null;
}

/**
 * The alarm digest (ADR-0023): one message per person per period listing what
 * the alarms **they made** newly flagged, in errors and warnings, in the
 * workspaces they still belong to. Sent only for a period in which something
 * new was flagged.
 *
 * **Once per period, across processes.** The loop is a per-process timer like
 * the sweep, so it runs in every API process; `alarm_digest_runs` is unique per
 * `(person, period)` and the process that inserts the row sends. The claim and
 * the queued message share one transaction: a message that fails to queue
 * un-claims the period and the next tick retries it.
 *
 * **Not before `digestHourUtc`.** A digest is a morning read; the first tick at
 * or after the hour sends it.
 *
 * With no mail provider the notice dispatcher is unbound and the loop never
 * arms — there is nobody to send through, and claiming periods would only
 * swallow them for the day a provider is configured.
 */
@Injectable()
export class AlarmDigestService
    implements OnApplicationBootstrap, OnModuleDestroy
{
    private readonly logger = new Logger(AlarmDigestService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private running: Promise<number> | null = null;
    private stopped = false;

    constructor(
        private readonly uow: UnitOfWork,
        private readonly digests: AlarmDigestRepository,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        @InjectAlarmsConfig() private readonly config: ResolvedAlarmsConfig,
        @Optional()
        @Inject(NOTIFICATION_DISPATCHER)
        private readonly mail?: NotificationDispatcher
    ) {}

    /** Whether digests can be sent at all on this deployment. */
    get available(): boolean {
        return Boolean(this.mail);
    }

    onApplicationBootstrap(): void {
        const minutes = this.config.digestIntervalMinutes;
        if (minutes <= 0 || !this.mail) return;
        this.timer = setInterval(
            () => void this.runOnce(),
            minutes * 60 * 1000
        );
        this.timer.unref?.();
    }

    async onModuleDestroy(): Promise<void> {
        this.stopped = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.running) await this.running;
    }

    /**
     * One pass: every recipient whose period is due and unclaimed. Returns how
     * many digests were queued. Public so a test can drive it with a clock.
     */
    async runOnce(now: Date = new Date()): Promise<number> {
        if (this.running) return this.running;
        this.running = this.pass(now).finally(() => {
            this.running = null;
        });
        return this.running;
    }

    private async pass(now: Date): Promise<number> {
        if (!this.mail || now.getUTCHours() < this.config.digestHourUtc) {
            return 0;
        }
        let sent = 0;
        for (const recipient of await this.digests.recipients()) {
            if (this.stopped) break;
            try {
                if (await this.sendTo(recipient, now)) sent += 1;
            } catch (error) {
                // One person's failure must not cost everybody else theirs.
                this.logger.warn(
                    `Alarm digest for ${recipient.userId} failed: ${(error as Error).message}`
                );
            }
        }
        return sent;
    }

    private async sendTo(
        recipient: DigestRecipient,
        now: Date
    ): Promise<boolean> {
        const mail = this.mail;
        const period = digestPeriod(recipient.frequency, now);
        if (!mail || !period) return false;

        return this.uow.run(async () => {
            const last = await this.digests.lastRunAt(recipient.userId);
            if (!(await this.digests.claim(recipient.userId, period.key))) {
                return false;
            }
            const since = last ?? new Date(now.getTime() - period.lengthMs);
            const lines = await this.digests.lines(recipient.userId, since);
            // A quiet period is claimed and sends nothing: "nothing new" is
            // not a message.
            if (!lines.length) return false;

            const sections = new Map<string, AlarmDigestSection>();
            for (const line of lines) {
                const section = sections.get(line.workspaceId) ?? {
                    workspaceName: line.workspaceName,
                    alarmsPath: `workspaces/${line.workspaceId}/alarms`,
                    lines: []
                };
                sections.set(line.workspaceId, {
                    ...section,
                    lines: [
                        ...section.lines,
                        {
                            name: line.ruleName,
                            severity: line.severity,
                            contentTypeLabel:
                                this.registry.get(line.contentType)?.label ??
                                line.contentType,
                            newCount: line.newCount,
                            openCount: line.openCount
                        }
                    ]
                });
            }
            await mail.notify({
                kind: NOTIFICATION_KINDS.ALARM_DIGEST,
                to: recipient.email,
                userId: recipient.userId,
                recipientName: recipient.name,
                period: recipient.frequency === 'weekly' ? 'weekly' : 'daily',
                sections: [...sections.values()],
                settingsPath: 'inbox/settings'
            });
            return true;
        });
    }
}
