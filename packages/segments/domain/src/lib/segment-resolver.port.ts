/**
 * The **segment resolver port** — where a reader's tags come from.
 *
 * The CMS does not own subscriptions, contracts or org charts, and this is the
 * seam that keeps it that way: an adapter answers "which tags does this caller
 * carry?", and everything downstream is the same regardless of whether the
 * answer came from signed claims, a billing API or a fixed list. The same
 * inversion `ModelProvider` uses for the copilot ([ADR-0004]), applied to
 * entitlements.
 *
 * Framework-free by construction — the request is a type parameter, so this
 * file knows nothing about Express, Nest or HTTP at all.
 */

import type { SegmentTag } from './segment-type';

/**
 * Resolves one caller's tags.
 *
 * **Failure is closed.** An adapter that cannot reach its source, or that is
 * handed an unverifiable credential, returns an empty set — it does not throw
 * to signal "unknown" and it never returns a permissive default. An empty set
 * still reads everything unrestricted, so a resolver outage degrades to "public
 * content only" rather than to an outage of its own.
 *
 * Implementations must be cheap enough to run per request, or do their own
 * caching: the read path calls this once per request, before the query, and the
 * SQL predicate is built synchronously from the result.
 */
export interface SegmentResolver<TRequest = unknown> {
    /** The tags this caller carries. Empty when unknown — never permissive. */
    resolve(request: TRequest): Promise<ReadonlySet<SegmentTag>>;
}

/**
 * A resolver that always answers the same tags.
 *
 * Shipped rather than kept in tests: it is how a development stack and CI
 * exercise restricted content with no billing system in reach, the way
 * `copilot-provider-fake` is for the chat.
 */
export function staticSegmentResolver<TRequest = unknown>(
    tags: Iterable<SegmentTag>
): SegmentResolver<TRequest> {
    const frozen: ReadonlySet<SegmentTag> = new Set(tags);
    return { resolve: () => Promise.resolve(frozen) };
}

/** A resolver that grants nothing — the safe default and the failure mode. */
export function anonymousSegmentResolver<
    TRequest = unknown
>(): SegmentResolver<TRequest> {
    return staticSegmentResolver<TRequest>([]);
}
