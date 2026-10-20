/**
 * The operator's limits on how much the copilot may be used — as opposed to
 * `RunLimits`, which bound one run. Every field is optional and an absent one
 * means "no limit", so a deployment that sets nothing behaves as before.
 */
export interface CopilotQuotas {
    /**
     * Billable tokens one user may spend **in one workspace** per UTC day.
     * Counted with `billableTokens`, the same sum the run ceiling uses.
     */
    userDailyTokens?: number;
    /** Billable tokens every member of a workspace may spend together per UTC day. */
    workspaceDailyTokens?: number;
    /** Runs one user may start per rolling minute, across workspaces. */
    runsPerMinute?: number;
    /** Runs one user may have in flight at once, across workspaces. */
    maxConcurrentRuns?: number;
}

/** What has been spent, read under the lock that admits a run. */
export interface UsageSnapshot {
    /** The user's live runs — `running` rows recent enough not to be orphans. */
    activeRuns: number;
    /** Billable tokens the user has spent in this workspace today. */
    userTokensToday: number;
    /** Billable tokens the whole workspace has spent today. */
    workspaceTokensToday: number;
}

/**
 * Why a run was refused, as the wire names it. Prefixed so an API client can
 * tell these apart from any other 429 the host may one day send.
 */
export const COPILOT_LIMIT_CODES = {
    /** A daily token quota is spent. */
    QUOTA_EXCEEDED: 'copilot.quota_exceeded',
    /** Too many runs started in the last minute. */
    RATE_LIMITED: 'copilot.rate_limited',
    /** Too many runs in flight at once. */
    TOO_MANY_RUNS: 'copilot.too_many_runs'
} as const;

/** One of {@link COPILOT_LIMIT_CODES}. */
export type CopilotLimitCode =
    (typeof COPILOT_LIMIT_CODES)[keyof typeof COPILOT_LIMIT_CODES];

/** Whose limit refused the run. */
export type CopilotLimitScope = 'user' | 'workspace';

/** A refusal, in the shape the 429 body carries. */
export interface CopilotLimitRefusal {
    code: CopilotLimitCode;
    scope: CopilotLimitScope;
    /** When a daily quota starts over — set for `quota_exceeded`. */
    resetsAt?: Date;
    /**
     * How long until a retry can succeed — set for `rate_limited`. A quota's
     * wait is `resetsAt` minus the clock the caller answers with.
     */
    retryAfterMs?: number;
}

/** The UTC day a moment falls in. */
export interface UsageDay {
    /** `YYYY-MM-DD`. */
    day: string;
    /** Midnight UTC that opens it. */
    start: Date;
    /** Midnight UTC that closes it — when every daily quota starts over. */
    resetsAt: Date;
}

const DAY_MS = 86_400_000;

/**
 * The UTC day `now` falls in.
 *
 * UTC rather than the deployment's zone: every instance agrees on it without
 * configuration, and a run is charged to the day it **started** in, so a run
 * crossing midnight is never split.
 */
export function usageDay(now: Date): UsageDay {
    const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    return {
        day: start.toISOString().slice(0, 10),
        start,
        resetsAt: new Date(start.getTime() + DAY_MS)
    };
}

/**
 * Whether admitting a run needs a usage snapshot at all. With neither a daily
 * quota nor a concurrency cap there is nothing to read, and the run's row can
 * be written without taking a lock.
 */
export function needsUsageSnapshot(quotas: CopilotQuotas): boolean {
    return (
        quotas.userDailyTokens !== undefined ||
        quotas.workspaceDailyTokens !== undefined ||
        quotas.maxConcurrentRuns !== undefined
    );
}

/**
 * Decides whether a run may start, or the first limit that refuses it.
 *
 * The order is the order a person can act on: a run already in flight is
 * something they can wait out in seconds, so it is reported before a quota
 * that only midnight lifts — and the user's own quota before the workspace's,
 * because "you have used your share" is the more precise sentence when both
 * are true.
 */
export function admitRun(
    snapshot: UsageSnapshot,
    quotas: CopilotQuotas,
    day: UsageDay
): CopilotLimitRefusal | null {
    if (
        quotas.maxConcurrentRuns !== undefined &&
        snapshot.activeRuns >= quotas.maxConcurrentRuns
    ) {
        return { code: COPILOT_LIMIT_CODES.TOO_MANY_RUNS, scope: 'user' };
    }
    if (
        quotas.userDailyTokens !== undefined &&
        snapshot.userTokensToday >= quotas.userDailyTokens
    ) {
        return quotaExceeded('user', day);
    }
    if (
        quotas.workspaceDailyTokens !== undefined &&
        snapshot.workspaceTokensToday >= quotas.workspaceDailyTokens
    ) {
        return quotaExceeded('workspace', day);
    }
    return null;
}

/**
 * How many billable tokens an admitted run may spend before it is stopped
 * with `quota` — the smaller of the two quotas' remainders, or `Infinity`
 * when neither is set.
 *
 * Computed once, at admission. A colleague's run in the same workspace spends
 * from the same quota meanwhile and this figure does not see it, so a
 * workspace can overshoot by what its concurrent runs spend before their next
 * admission — the same between-steps bound `maxTotalTokens` already accepts,
 * traded for not querying the ledger on every step.
 */
export function remainingBudget(
    snapshot: UsageSnapshot,
    quotas: CopilotQuotas
): number {
    let remaining = Infinity;
    if (quotas.userDailyTokens !== undefined) {
        remaining = Math.min(
            remaining,
            quotas.userDailyTokens - snapshot.userTokensToday
        );
    }
    if (quotas.workspaceDailyTokens !== undefined) {
        remaining = Math.min(
            remaining,
            quotas.workspaceDailyTokens - snapshot.workspaceTokensToday
        );
    }
    return Math.max(remaining, 0);
}

function quotaExceeded(
    scope: CopilotLimitScope,
    day: UsageDay
): CopilotLimitRefusal {
    return {
        code: COPILOT_LIMIT_CODES.QUOTA_EXCEEDED,
        scope,
        resetsAt: day.resetsAt
    };
}
