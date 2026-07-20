/** Local filesystem provider settings. */
export interface MediaLocalConfig {
    /** Directory blobs are written under (absolute or project-relative). */
    rootDir: string;
    /** Base path the browser hits to stream a blob (the download route). */
    publicBasePath: string;
}

/** AWS S3 provider settings (used once the S3 adapter lands). */
export interface MediaS3Config {
    bucket: string;
    region: string;
}

/**
 * The media plugin's host-supplied config. `defaultProvider` names the provider
 * the core falls back to when no custom resolver is supplied. The provider
 * connection settings live here; the routing handler (if any) is code in the
 * composition root, not config.
 */
export interface MediaPluginConfig {
    defaultProvider: string;
    local: MediaLocalConfig;
    s3: MediaS3Config;
    /** Upper bound on a single upload, in bytes. */
    maxUploadBytes: number;
}
