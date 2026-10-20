import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    admitRun,
    COPILOT_LIMIT_CODES,
    DEFAULT_RUN_LIMITS,
    needsUsageSnapshot,
    remainingBudget,
    usageDay,
    type CopilotQuotas
} from '@orthacms/copilot-domain';
import { RateLimiter } from '@orthacms/identity-server';
import { InjectCopilotConfig } from '../../copilot.tokens';
import type { CopilotPluginConfig } from '../../types/copilot-config';
import { DEFAULT_RUN_DECISION_BUDGET_MS } from '../../chat/application/tool-permission.broker';
import { UsageRepository } from '../infrastructure/persistence/usage.repository';
import { CopilotLimitError } from './copilot-limit.error';
import { RunMeter } from './run-meter';

/** How much grace an orphan gets past the longest a run can legitimately live. */
const ORPHAN_GRACE_MS = 60_000;

/** The window the per-minute rate limit counts over. */
const RATE_WINDOW_MS = 60_000;

/** Who is asking to start a run. */
export interface RunRequester {
    userId: string;
    workspaceId: string;
}

/** What `GET /api/copilot/usage` serves. */
export interface UsageSummary {
    /** The UTC day being counted, `YYYY-MM-DD`. */
    day: string;
    /** When every daily quota starts over. */
    resetsAt: Date;
    /** The caller's own spend in this workspace, and their quota. */
    user: { used: number; limit: number | null };
    /**
     * Only whether the workspace's quota is spent — never the figure. How
     * much colleagues have used is not something an ordinary member needs.
     */
    workspace: { exhausted: boolean };
}

/**
 * Admits copilot runs against the operator's usage limits, and opens the
 * ledger row each admitted run is charged to.
 *
 * Called by the run controller **before** the stream opens, so a refusal can
 * still be an HTTP status. The order is cheapest-first: the per-minute rate
 * limit is one upsert in `throttle_buckets` and touches nothing else; the
 * concurrency cap and the daily quotas need the ledger, read under a lock.
 */
@Injectable()
export class CopilotQuotaService {
    private readonly quotas: CopilotQuotas;
    /** A `running` row last written longer ago than this is an orphan. */
    private readonly orphanAfterMs: number;

    constructor(
        @InjectCopilotConfig() config: CopilotPluginConfig,
        private readonly ledger: UsageRepository,
        // Optional, and named explicitly because `X | null` emits `Object`
        // for `design:paramtypes`. Every host registers identity, so this is
        // always bound in practice; absent (a module test, a host with no
        // sessions) the per-minute limit simply has nowhere to count.
        @Optional()
        @Inject(RateLimiter)
        private readonly rateLimiter: RateLimiter | null = null
    ) {
        this.quotas = config.quotas ?? {};
        // The longest a live run can go without writing its row: the whole
        // wall clock, plus a permission wait (which the wall clock does not
        // cover while parked), plus grace. A run its owner keeps extending
        // past that stops holding a slot — it is waiting on them, not
        // spending.
        this.orphanAfterMs =
            (config.limits?.wallClockMs ?? DEFAULT_RUN_LIMITS.wallClockMs) +
            (config.permissionDecisionBudgetMs ??
                DEFAULT_RUN_DECISION_BUDGET_MS) +
            ORPHAN_GRACE_MS;
    }

    /**
     * Admits a run or throws {@link CopilotLimitError}.
     *
     * An admitted run already has its `running` row; the meter returned is
     * the engine's handle on it, and **must** be finished — the engine does
     * that in its `finally`.
     */
    async begin(requester: RunRequester, now = new Date()): Promise<RunMeter> {
        if (this.quotas.runsPerMinute !== undefined && this.rateLimiter) {
            const decision = await this.rateLimiter.consume(
                `copilot:runs:${requester.userId}`,
                { limit: this.quotas.runsPerMinute, windowMs: RATE_WINDOW_MS }
            );
            if (!decision.allowed) {
                throw new CopilotLimitError({
                    code: COPILOT_LIMIT_CODES.RATE_LIMITED,
                    scope: 'user',
                    retryAfterMs: decision.retryAfterMs
                });
            }
        }

        const day = usageDay(now);
        const runId = randomUUID();
        const window = needsUsageSnapshot(this.quotas)
            ? {
                  dayStart: day.start,
                  liveSince: new Date(now.getTime() - this.orphanAfterMs)
              }
            : null;
        const { snapshot, refusal } = await this.ledger.open(
            { runId, ...requester },
            now,
            window,
            (spent) => admitRun(spent, this.quotas, day)
        );
        if (refusal) {
            throw new CopilotLimitError(refusal);
        }
        return new RunMeter(
            runId,
            remainingBudget(snapshot, this.quotas),
            this.ledger
        );
    }

    /** Today's spend, as the panel's meter shows it. */
    async summary(
        requester: RunRequester,
        now = new Date()
    ): Promise<UsageSummary> {
        const day = usageDay(now);
        const spent = await this.ledger.spentSince(
            requester.userId,
            requester.workspaceId,
            day.start
        );
        const workspaceLimit = this.quotas.workspaceDailyTokens;
        return {
            day: day.day,
            resetsAt: day.resetsAt,
            user: {
                used: spent.user,
                limit: this.quotas.userDailyTokens ?? null
            },
            workspace: {
                exhausted:
                    workspaceLimit !== undefined &&
                    spent.workspace >= workspaceLimit
            }
        };
    }
}
