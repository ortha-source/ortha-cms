import type { MediaKind } from '../../constants';

/**
 * A single media asset in the library — an uploaded file (image, video, audio,
 * document, or archive) with its display metadata. This is the admin's model;
 * once a media server exists it will be mapped from that API's wire shape.
 */
export type MediaAsset = {
    /** Stable unique id. */
    id: string;
    /** File name shown to the user (includes extension). */
    name: string;
    /** Coarse category driving the icon, badge, and kind filter. */
    kind: MediaKind;
    /** Route the browser fetches to stream the bytes (preview / download). */
    url: string;
    /** MIME type, e.g. `image/png`. */
    mimeType: string;
    /** File size in bytes. */
    size: number;
    /** Id of the folder the asset lives in (`ROOT_FOLDER_ID` at the top level). */
    folderId: string;
    /** Pixel dimensions for visual assets (`undefined` for audio/documents). */
    dimensions?: { width: number; height: number };
    /** Playback duration in seconds for audio/video. */
    duration?: number;
    /** Free-form labels for filtering and organisation. */
    tags: string[];
    /** Alternative text (accessibility) for images. */
    alt?: string;
    /** Display name of the member who uploaded it. */
    uploadedBy: string;
    /** ISO timestamp the asset was created/uploaded. */
    createdAt: string;
    /** ISO timestamp the asset was last modified. */
    updatedAt: string;
};
