import { MEDIA_KIND, type MediaKind } from '../../constants';

/** MIME types the library counts as an archive. */
const ARCHIVE_TYPES: readonly string[] = [
    'application/zip',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed',
    'application/vnd.rar'
];

/**
 * The coarse {@link MediaKind} for a MIME type. A **local, deliberately rough**
 * classification for a file that hasn't been uploaded yet (a staged upload's
 * preview tile) — the server owns the real one, and it's the server's `kind`
 * that ends up on the asset. Unknown types read as a document, which is what the
 * glyph fallback should be anyway.
 */
export function kindFromMime(mimeType: string): MediaKind {
    if (mimeType.startsWith('image/')) return MEDIA_KIND.Image;
    if (mimeType.startsWith('video/')) return MEDIA_KIND.Video;
    if (mimeType.startsWith('audio/')) return MEDIA_KIND.Audio;
    if (ARCHIVE_TYPES.includes(mimeType)) return MEDIA_KIND.Archive;
    return MEDIA_KIND.Document;
}
