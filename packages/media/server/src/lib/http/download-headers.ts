/**
 * The response headers a media download must carry, derived from the asset's
 * stored (client-declared) MIME type.
 *
 * The type on a `media_asset` row is whatever the uploader's multipart part
 * claimed — nothing sniffs the bytes — so the download route must assume it is
 * hostile. Served naively (`Content-Type: text/html`, `Content-Disposition:
 * inline`, no other headers) an uploaded `.html` or scripted `.svg` becomes
 * **stored XSS on the app's own origin**, because `/api/media/...` is same-origin
 * with the admin behind the dev proxy and in every deployment that fronts both
 * from one host.
 *
 * Three layers, applied by both download routes (session and `/v1`):
 *
 * 1. `X-Content-Type-Options: nosniff` — the browser never upgrades a declared
 *    `text/plain` into `text/html` by sniffing the body.
 * 2. A restrictive `Content-Security-Policy` — a document that *is* served
 *    inline (or force-navigated to) loads no scripts, no subresources, and sits
 *    in a unique opaque origin, so even an HTML/SVG body cannot reach the app's
 *    cookies or DOM.
 * 3. `Content-Disposition: attachment` for everything outside a small allowlist
 *    of types a browser renders safely. Disposition only affects **navigations**
 *    — `<img src>`, `<video>` and friends ignore it — so the Media Library's
 *    tiles and previews keep working while a direct hit on a booby-trapped file
 *    downloads instead of executing.
 */

/**
 * MIME types safe to render inline in a browser tab. Everything else — HTML,
 * XML, SVG, JSON, anything unrecognized — is served as an attachment.
 *
 * SVG is **deliberately excluded**: it is an image, but it is also a scriptable
 * document when navigated to directly. `<img src=…>` still renders it because
 * subresource loads ignore `Content-Disposition`.
 */
const INLINE_SAFE_TYPES = new Set([
    'application/pdf',
    'text/plain',
    'image/apng',
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/x-icon'
]);

/** Media type prefixes rendered inline (audio/video players are inert). */
const INLINE_SAFE_PREFIXES = ['audio/', 'video/'];

/**
 * Locks a downloaded document into an opaque origin with no capabilities:
 * `sandbox` (no allow-* tokens) blocks script execution, form submission and
 * same-origin access; `default-src 'none'` blocks every subresource.
 */
export const DOWNLOAD_CSP =
    "default-src 'none'; sandbox; base-uri 'none'; form-action 'none'";

/** The headers + disposition one download response should be sent with. */
export interface DownloadHeaders {
    /** `inline` or `attachment`, with the escaped file name attached. */
    disposition: string;
    /** Extra security headers to set on the response. */
    headers: Record<string, string>;
}

/** True when a browser may render this type inline without executing it. */
export function isInlineSafe(mimeType: string): boolean {
    const type = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    return (
        INLINE_SAFE_TYPES.has(type) ||
        INLINE_SAFE_PREFIXES.some((prefix) => type.startsWith(prefix))
    );
}

/**
 * Builds the `Content-Disposition` plus the hardening headers for one asset.
 * The file name is percent-encoded, so a quote or a control character in
 * `media_asset.name` cannot break out of the header value.
 */
export function downloadHeadersFor(
    mimeType: string,
    fileName: string
): DownloadHeaders {
    const kind = isInlineSafe(mimeType) ? 'inline' : 'attachment';
    return {
        disposition: `${kind}; filename="${encodeURIComponent(fileName)}"`,
        headers: {
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': DOWNLOAD_CSP
        }
    };
}
