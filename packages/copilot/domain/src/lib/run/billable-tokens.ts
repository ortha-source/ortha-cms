import type { ModelUsage } from '../model/model-provider';

/**
 * The tokens a run is **charged** for — the one sum both the run's own ceiling
 * (`RunLimits.maxTotalTokens`) and the daily quotas count.
 *
 * Uncached input + output + cache **writes**. Cache **reads** are left out: a
 * read costs about a tenth of plain input and is the whole point of caching,
 * so charging for it would spend a budget re-reading a prompt the provider
 * already holds. A write is billed at a premium over plain input, so leaving
 * it out would let caching make a run look cheaper than it is.
 *
 * One function rather than the same three-term sum in two places: "this run
 * spent 40k" has to mean the same thing to the ceiling that stops it and to
 * the quota that refuses the next one.
 */
export function billableTokens(usage: ModelUsage): number {
    return (
        usage.inputTokens +
        usage.outputTokens +
        (usage.cacheWriteInputTokens ?? 0)
    );
}
