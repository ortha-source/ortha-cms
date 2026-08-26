/**
 * Where a reader's tags come from.
 *
 * The one thing this package cannot know: a deployment's readers are its own —
 * a JWT claim, a header the CDN sets, a lookup against a billing system. So the
 * host implements this, and everything above it deals in tags.
 *
 * **It fails closed by returning nothing, never by throwing.** An unreachable
 * source produces the anonymous reader, who still sees every unrestricted
 * entry; taking the site down over content most of its readers can see anyway
 * is the wrong trade.
 */
export interface SegmentResolver<TRequest = unknown> {
    /** The tags this reader carries. Empty is the anonymous reader. */
    resolve(request: TRequest): Promise<readonly string[]>;
}

/** A resolver that always answers with the same tags — for tests and demos. */
export function staticSegmentResolver<TRequest>(
    tags: readonly string[]
): SegmentResolver<TRequest> {
    return { resolve: async () => tags };
}

/**
 * The resolver a deployment gets when it configures none: every reader is
 * anonymous, so unrestricted content serves and restricted content does not.
 * That is the honest default — the alternative, treating an unknown reader as
 * unconstrained, turns every gap in configuration into an open door.
 */
export function anonymousSegmentResolver<
    TRequest
>(): SegmentResolver<TRequest> {
    return { resolve: async () => [] };
}
