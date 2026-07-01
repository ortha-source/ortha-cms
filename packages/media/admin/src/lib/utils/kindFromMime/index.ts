import { MEDIA_KIND, type MediaKind } from '../../constants';

/**
 * Maps a MIME type to the library's coarse {@link MediaKind}. Used when a mock
 * upload synthesises an asset from a picked file. Falls back to `document` for
 * anything unrecognised (the neutral, always-valid bucket).
 */
export function kindFromMime(mimeType: string): MediaKind {
    if (mimeType.startsWith('image/')) return MEDIA_KIND.Image;
    if (mimeType.startsWith('video/')) return MEDIA_KIND.Video;
    if (mimeType.startsWith('audio/')) return MEDIA_KIND.Audio;
    if (
        mimeType.includes('zip') ||
        mimeType.includes('tar') ||
        mimeType.includes('rar') ||
        mimeType.includes('compressed')
    ) {
        return MEDIA_KIND.Archive;
    }
    return MEDIA_KIND.Document;
}
