/**
 * The **media-asset resolver port** — the seam through which content-server
 * checks that a media field's asset ids reference real assets in the workspace,
 * and match the field's `accept` restriction, without depending on the media
 * plugin. Content-server *declares* the port and consults it optionally
 * (`@Optional()` injection) from {@link EntryWriterService}; the media plugin
 * *binds* an implementation to {@link MEDIA_ASSET_RESOLVER} in its own module —
 * the same inversion as {@link CONTENT_ENTRY_EXTENSION} and identity's
 * `CONTENT_CATALOG`.
 *
 * When no implementation is bound (the media plugin isn't registered), media
 * fields still shape-validate and store their ids — the existence and
 * restriction checks are simply skipped, so content boots without media.
 *
 * NestJS-free on purpose (types + a Symbol + an inject helper): the
 * implementation lives in another package.
 */

import { Inject } from '@nestjs/common';

/** DI token the media plugin binds its {@link MediaAssetResolver} to. */
export const MEDIA_ASSET_RESOLVER = Symbol('MEDIA_ASSET_RESOLVER');

/** Injects the optional media-asset resolver. Pair with `@Optional()`. */
export const InjectMediaAssetResolver = (): ParameterDecorator =>
    Inject(MEDIA_ASSET_RESOLVER);

/**
 * One timed-text track on a video or audio asset — what a consumer needs to
 * emit a `<track>`.
 *
 * Declared here rather than imported from media-server because the dependency
 * runs the other way: media binds this port, content declares it (`ORT-92`).
 */
export interface ResolvedMediaTrack {
    /** `captions` / `subtitles` / `descriptions` / `chapters`. */
    kind: string;
    /** BCP-47 tag of the track's language. */
    srclang: string;
    /** The label a player shows in its track menu. */
    label: string;
    /** Route the WebVTT bytes stream from. */
    src: string;
    /** Whether a player should enable this one by default. */
    default?: boolean;
}

/**
 * An asset's **public** addresses — permanent, unauthenticated URLs a storage
 * provider publishes (a CDN in front of the bucket), which an anonymous reader
 * can load from an `<img src>`.
 *
 * Present on a {@link ResolvedMediaAsset} only when the media plugin has
 * decided the asset may be published: the operator opted in, the provider
 * declares the capability, and the asset's type passed the MIME gate. Carried
 * as its own block, rather than inferred from the shape of {@link
 * ResolvedMediaAsset.url}, because content-server cannot ask media-server and
 * must not guess: the public API rewrites every other URL to its own
 * token-authenticated route (ADR-0021).
 */
export interface ResolvedPublicMedia {
    /** The original. */
    url: string;
    /** The ~320px derivative, or the provider's own poster for a video. */
    thumbUrl?: string;
    /** The ~1280px derivative. */
    previewUrl?: string;
    /** Adaptive streaming manifests, for a provider that transcodes video. */
    streams?: { hls?: string; dash?: string };
}

/** The subset of a media asset content-server needs to enforce a media field. */
export interface ResolvedMediaAsset {
    /** Asset id (uuid). */
    id: string;
    /** Coarse kind — image/video/audio/document/archive. */
    kind: string;
    /** MIME type, e.g. `image/png`. */
    mimeType: string;
    /** Display name (the original file name). */
    name: string;
    /**
     * Where the browser fetches the bytes — the app's own session route, or
     * the asset's public URL when it has one (see {@link public}).
     */
    url: string;
    /**
     * Route for the small (~320px) derivative, when the media plugin generated
     * one — what a field tile or a revision-preview chip should render instead
     * of the full original. Absent for a non-image, an SVG, or an image too
     * small to derive; the caller falls back to {@link url}.
     */
    thumbUrl?: string;
    /** Route for the larger (~1280px) derivative, same caveats as {@link thumbUrl}. */
    previewUrl?: string;
    /** Alt text, when set. */
    alt: string | null;
    /**
     * Timed-text tracks for a video or audio asset. Empty for everything else,
     * and for a video nobody has captioned yet.
     *
     * Without these a published video had no caption track available **at any
     * layer**, because the CMS could not represent one — WCAG 1.2.2 / 1.2.3,
     * 508 503.4 (`ORT-92`).
     */
    tracks: ResolvedMediaTrack[];
    /**
     * The asset's public addresses, when the deployment publishes it. Absent
     * means every address for it requires authorization.
     */
    public?: ResolvedPublicMedia;
}

/**
 * Resolves media asset ids to the facts content-server needs. Workspace-scoped:
 * an id that names no asset in `workspaceId` (missing, or belonging to another
 * workspace) is simply **absent** from the returned map — the caller reads that
 * as "does not exist" and reports a uniform validation issue, with no
 * not-found-vs-forbidden enumeration signal.
 */
export interface MediaAssetResolver {
    /** Batched, workspace-scoped lookup keyed by asset id. */
    resolve(
        ids: readonly string[],
        workspaceId: string
    ): Promise<Map<string, ResolvedMediaAsset>>;
}
