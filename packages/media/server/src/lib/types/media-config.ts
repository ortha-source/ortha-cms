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
}
