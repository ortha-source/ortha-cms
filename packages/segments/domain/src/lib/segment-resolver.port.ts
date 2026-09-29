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

/** The part of a request {@link headerSegmentResolver} reads — Node's shape. */
export interface HeaderCarrier {
    headers: Record<string, string | readonly string[] | undefined>;
}

/**
 * A resolver that reads the reader's tags from one request header, as a
 * comma-separated list: `X-Reader-Tags: premium, eu`.
 *
 * The ready-made answer for the commonest deployment — a site's own backend
 * (an SSR frontend, a BFF, a CDN edge function) calls the content API with its
 * API token and says, per request, whom it is reading for. The token is what
 * makes the header trustworthy: whoever holds it could already read everything
 * the token's workspace publishes, so letting them also name the reader grants
 * nothing new. What it must not become is a header a **browser** sets — so the
 * token stays server-side, as it has to anyway.
 *
 * Header names are case-insensitive on the wire and Node lower-cases them, so
 * the configured name is lower-cased here once. A repeated header is joined, so
 * `X-Reader-Tags: a` twice reads as both. Blank entries are dropped, which makes
 * an empty or absent header the anonymous reader. It never throws.
 */
export function headerSegmentResolver<TRequest extends HeaderCarrier>(
    headerName: string
): SegmentResolver<TRequest> {
    const name = headerName.trim().toLowerCase();
    return {
        resolve: async (request) => {
            const raw = request.headers[name];
            const value = typeof raw === 'string' ? raw : (raw ?? []).join(',');
            return value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
        }
    };
}
