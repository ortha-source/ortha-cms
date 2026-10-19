import type { CopilotUsage } from './useCopilotUsage';

/** From this share of the quota on, the meter turns to a warning. */
export const USAGE_WARNING_FROM = 0.8;

/** What the meter under the composer draws. */
export interface UsageMeterState {
    /**
     * `normal` under {@link USAGE_WARNING_FROM}, `warning` from it, and
     * `exhausted` once the user's quota — or the workspace's — is spent.
     */
    level: 'normal' | 'warning' | 'exhausted';
    /** Whose quota is spent, when `level` is `exhausted`. */
    scope: 'user' | 'workspace' | null;
    /** Tokens spent today; `null` when only the workspace has a quota. */
    used: number | null;
    /** The user's daily quota; `null` when only the workspace has one. */
    limit: number | null;
    /** What is left of the user's quota; `null` without one. */
    remaining: number | null;
    /** The bar's fill, 0–1. */
    fraction: number;
    /** When it all starts over. */
    resetsAt: Date;
}

/**
 * What the meter shows for a usage summary — or `null`, which means **draw
 * nothing**: no quota applies to this user here, and a meter for a limit that
 * does not exist is a number about nothing.
 *
 * The workspace's quota is never a figure (the server does not send one), so
 * on its own it draws nothing until it is spent — and then it draws the same
 * exhausted state as the user's own, because either way the next send would
 * be refused.
 */
export function usageMeterState(
    usage: CopilotUsage | undefined
): UsageMeterState | null {
    if (!usage) {
        return null;
    }
    const { used, limit } = usage.user;
    const userExhausted = limit !== null && used >= limit;
    if (limit === null && !usage.workspace.exhausted) {
        return null;
    }
    const fraction = limit === null ? 1 : Math.min(used / limit, 1);
    const exhausted = userExhausted || usage.workspace.exhausted;
    return {
        level: exhausted
            ? 'exhausted'
            : fraction >= USAGE_WARNING_FROM
              ? 'warning'
              : 'normal',
        scope: userExhausted ? 'user' : exhausted ? 'workspace' : null,
        used: limit === null ? null : used,
        limit,
        remaining: limit === null ? null : Math.max(limit - used, 0),
        fraction: exhausted ? 1 : fraction,
        resetsAt: usage.resetsAt
    };
}
