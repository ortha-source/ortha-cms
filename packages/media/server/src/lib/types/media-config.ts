import type { DirectServeMode } from '../http/direct-serve';

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
}
