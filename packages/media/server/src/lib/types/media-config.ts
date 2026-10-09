import type { DirectServeMode } from '../http/direct-serve';
import type {
    PublicUrlsMode,
    PublicUrlTypes
} from '../infrastructure/public-urls/public-asset-urls';

/**
 * The media plugin's host-supplied config.
 *
 * It names **no backend**. Which storage a deployment runs is decided by which
 * provider object the composition root constructs and passes to
 * `MediaServerPlugin`; the settings that provider needs are the host's own
 * config, typed by the factory the host imports (the same arrangement the
 * copilot uses for its model adapters, ADR-0004 §2).
 */
export interface MediaPluginConfig {
    /** Upper bound on a single upload, in bytes. */
    maxUploadBytes: number;
    /**
     * How a download reaches the browser. Defaults to `off` — every byte
     * streams through the app, which is the only safe answer for a backend
     * that cannot pin response headers onto a URL.
     *
     * `signed-url` redirects an already-authorized download to the backend.
     * The plugin refuses to boot it against a provider that declares no
     * `directUrl` capability.
     */
    directServe?: DirectServeMode;
    /**
     * Lifetime of a signed URL, in seconds. Default 300 — long enough for a
     * page of thumbnails to load, short enough that a leaked URL is worth
     * little. The URL is not a capability grant to the asset: it expires, and
     * the route that mints it re-authorizes on every request.
     */
    directServeTtlSeconds?: number;
    /**
     * Whether the API reports the storage provider's **permanent public URLs**
     * (a CDN in front of the backend) instead of the app's own authorized
     * routes. Defaults to `off`.
     *
     * `provider` hands out URLs that bypass every check the app makes on a
     * download — membership, the token's workspace, reader entitlements — and
     * that are served with the CDN's headers rather than the app's hardening.
     * The plugin refuses to boot it against a provider that declares no
     * `publicUrls` capability (ADR-0021).
     */
    publicUrls?: PublicUrlsMode;
    /**
     * Which assets may be published, by stored MIME type. Defaults to
     * `inline-safe`: only types the download route itself serves inline
     * (raster images, audio, video, PDF, plain text), so an uploaded `.html` or
     * `.svg` keeps the app's route. `all` is for a CDN that sets
     * `nosniff`, a sandboxing CSP and attachment disposition itself.
     */
    publicUrlTypes?: PublicUrlTypes;
}
