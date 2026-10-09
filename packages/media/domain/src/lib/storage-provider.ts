import type { Readable } from 'node:stream';

/** A stored blob's provider-assigned coordinates plus verified metadata. */
export interface StoredObject {
    /** Opaque, provider-owned key persisted on the asset row; never parsed here. */
    storageKey: string;
    /** Bytes actually written. */
    size: number;
    /** sha256 hex of the bytes — integrity / future dedup. */
    checksum: string;
}

/** Inputs a provider needs to place one object. The core mints the `assetId`. */
export interface PutObject {
    workspaceId: string;
    assetId: string;
    fileName: string;
    contentType: string;
    /** The upload body, a stream so large files never buffer fully in memory. */
    body: Readable;
    /**
     * When set, this blob is a generated derivative (e.g. a `thumb`/`preview`
     * of the original), not the uploaded file itself. Providers key it in a
     * separate namespace so a derivative can never overwrite the original —
     * even when the user's file is literally named `thumb.webp`.
     */
    isVariant?: boolean;
}

/**
 * What a backend can do, so the core never has to assume the weakest one.
 *
 * Declared rather than detected: a capability the core guesses wrong is either
 * a feature silently not used, or a response served without the hardening the
 * download route applies.
 */
export interface StorageCapabilities {
    /**
     * Whether {@link StorageProvider.directUrl} is implemented — the browser can
     * fetch the blob without streaming it through the app.
     */
    directUrl: boolean;
    /**
     * Whether the stored object carries its content type. A filesystem has
     * nowhere to put one and drops it; an object store persists it as metadata.
     */
    contentTypeMetadata: boolean;
    /** Whether `put` streams the body rather than buffering it whole. */
    streamingPut: boolean;
    /**
     * Whether {@link StorageProvider.publicUrls} is implemented — the backend
     * (or a CDN in front of it) serves stored objects at permanent URLs anyone
     * can fetch. The core reports them only when the operator also sets
     * `publicUrls: 'provider'` in the media config (ADR-0021).
     */
    publicUrls: boolean;
}

/** How a direct URL must present the blob it points at. */
export interface DirectUrlOptions {
    /**
     * How the browser must treat the response. A redirect discards the app's
     * own `Content-Disposition`, and `media_asset.mime_type` is the uploader's
     * unverified claim, so a provider that cannot pin this on the signed URL
     * must declare `capabilities.directUrl: false` and be proxied instead.
     */
    disposition: 'inline' | 'attachment';
    /** File name the download is offered under. */
    fileName: string;
    /** Content type the response must carry, pinned the same way. */
    contentType: string;
    /** How long the URL stays valid, in seconds. */
    expiresInSeconds: number;
}

/**
 * Permanent, unauthenticated URLs for one stored object — what a CDN in front of
 * the backend serves it at.
 *
 * **A public URL is a capability grant.** Whoever holds it can fetch the bytes
 * with no session, no token, no workspace scope and no reader entitlement, for
 * as long as the backend keeps serving it, and the response carries whatever
 * headers the CDN sets rather than the hardening the app's own download route
 * applies. That is why the core reports these only when the operator opts in,
 * and by default only for types a browser renders inertly (ADR-0021).
 */
export interface PublicAssetUrls {
    /** The object itself, as an absolute `http(s)` URL. */
    url: string;
    /**
     * A provider-native poster or thumbnail — a video service's poster frame,
     * say. Used when the core generated no `thumb` derivative of its own.
     */
    thumbnailUrl?: string;
    /** Adaptive streaming manifests, for a backend that transcodes video. */
    streams?: {
        /** HLS playlist (`.m3u8`). */
        hls?: string;
        /** MPEG-DASH manifest (`.mpd`). */
        dash?: string;
    };
}

/** What the core tells {@link StorageProvider.publicUrls} about the object. */
export interface PublicUrlContext {
    /**
     * The object's content type: the asset's stored MIME type for an original,
     * the derivative's own (`image/webp`) for a derivative.
     */
    mimeType: string;
    /** The asset's coarse kind — `image` / `video` / `audio` / `document` / `archive`. */
    kind: string;
    /**
     * Set when the key is a generated derivative rather than the upload itself
     * — the derivative's name (`thumb`, `preview`). Absent for an original.
     */
    variant?: string;
}

/**
 * The storage boundary — **one** implementation per deployment, constructed at
 * the composition root and passed to `MediaServerPlugin` as a plain object
 * (`@orthacms/media-provider-local`, `-s3`, …). The media core depends only on
 * this interface and never on a concrete backend.
 */
export interface StorageProvider {
    /**
     * Stable identifier for this backend, owned by the provider itself.
     *
     * Recorded on every asset row (`media_asset.storage_provider`), so it is
     * data rather than a label: renaming it after rows exist strands them, and
     * `StorageProviderCheck` fails the boot rather than letting the mismatch
     * surface as 404s. It is the provider's own fact for exactly that reason —
     * a name the host passed alongside the object could be misspelled in one
     * deployment and correct in another, for the same adapter.
     */
    readonly id: string;
    /** What this backend can do. See {@link StorageCapabilities}. */
    readonly capabilities: StorageCapabilities;
    /**
     * Writes one object and returns its key + verified size/checksum.
     *
     * **Must be all-or-nothing.** The core reclaims blobs by key, and a `put`
     * that rejects never handed one back — so anything a failed write leaves
     * behind is unreachable garbage no caller can clean up. Implementations
     * write to a temporary key and move it into place, or remove the partial
     * object before rejecting.
     */
    put(object: PutObject): Promise<StoredObject>;
    /**
     * Opens a read stream for download.
     *
     * **Rejects with `ObjectNotFoundError` if the key is gone**, and rejects
     * *before* yielding a stream. Both halves are the contract: an
     * implementation that opens lazily resolves fine and then fails once the
     * response is already a streaming 200 that can no longer become a 404, and
     * one that lets its driver's own error escape makes a missing blob a 500
     * for every caller. The row exists and the bytes do not, which from the
     * caller's side is indistinguishable from a missing asset.
     */
    get(storageKey: string): Promise<Readable>;
    /** Removes a stored object. Idempotent — a missing key is a no-op. */
    remove(storageKey: string): Promise<void>;
    /**
     * A URL the browser can fetch directly (e.g. a signed S3 URL). Implemented
     * only when `capabilities.directUrl` is true; the download route still
     * streams through the app until direct serving is switched on.
     */
    directUrl?(storageKey: string, options: DirectUrlOptions): Promise<string>;
    /**
     * Permanent public URLs for a stored object, or `undefined` when this
     * object has none (a key the CDN does not front, a route this backend keeps
     * private). Implemented only when `capabilities.publicUrls` is true.
     *
     * Called for originals **and** for derivative keys (`context.variant` says
     * which), batched per page of assets, so it should be cheap: build the URL
     * from the key, do not round-trip to the backend per call. It may be
     * synchronous or return a promise.
     *
     * The core never calls it unless the operator set `publicUrls: 'provider'`,
     * and never for an asset whose type its MIME gate holds back — so a
     * provider describes **where** an object is public, and the deployment
     * decides **whether** to say so. A throw, or a value that is not an
     * absolute `http(s)` URL, falls back to the app's own authorized route.
     */
    publicUrls?(
        storageKey: string,
        context: PublicUrlContext
    ): PublicAssetUrls | undefined | Promise<PublicAssetUrls | undefined>;
    /**
     * Cheap liveness check run once at boot — credentials, bucket, writability.
     * Optional: a provider with nothing to verify simply omits it. Throwing
     * fails the boot, which is the point: a wrong bucket should not first
     * surface as a failed upload hours later.
     */
    verify?(): Promise<void>;
}

/** DI token the composition root binds to the deployment's {@link StorageProvider}. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
