/**
 * What a media node's `src` is allowed to be.
 *
 * Same reasoning as the Link extension's protocol allowlist, applied to the one
 * other place this editor writes a URL into published content. An `<img>` whose
 * `src` is `javascript:` doesn't execute anywhere current, but the value still
 * ends up in a `richtext` body that goes out to whatever renders it — a server
 * template, an RSS feed, a native app — and none of those are this browser's
 * URL parser. Refusing a scheme the editor never had a reason to produce costs
 * nothing and keeps the stored HTML boring.
 */

/** Schemes a media source may name. Anything else is refused. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Whether `src` is safe to store on a media node.
 *
 * Accepts absolute `http(s)` URLs and same-origin **paths** — the second is not
 * a nicety, it is the common case: the Media Library serves assets from
 * `/api/media/assets/…`, and a stored absolute URL would pin the content to
 * whichever host the author happened to be on.
 *
 * A protocol-relative `//host/…` is refused: it inherits whatever scheme the
 * *consumer* is on, which is not something this editor can vouch for.
 */
export function isSafeMediaSrc(src: unknown): src is string {
    if (typeof src !== 'string') return false;
    const value = src.trim();
    if (value === '' || value.startsWith('//')) return false;
    // A root-relative or relative path — no scheme to vet.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return true;
    try {
        return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
    } catch {
        return false;
    }
}

/** `src` if it passes {@link isSafeMediaSrc}, else `''` — the "render nothing" value. */
export function safeMediaSrc(src: unknown): string {
    return isSafeMediaSrc(src) ? src.trim() : '';
}
