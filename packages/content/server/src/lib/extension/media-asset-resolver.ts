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
    /** The route the browser fetches to stream the bytes. */
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
