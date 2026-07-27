/** The coarse media categories the library groups assets by. */
export type MediaKindValue =
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'archive';

/** MIME types classified as archives (everything else non-AV is a document). */
const ARCHIVE_MIME_TYPES = new Set([
    'application/zip',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed',
    'application/x-rar-compressed'
]);

/**
 * Derives the coarse {@link MediaKindValue} from a MIME type — the server side
 * of the admin's `kindFromMime`. A value object so the mapping lives in one
 * place and callers pass a `MediaKind`, not a bare string.
 */
export class MediaKind {
    private constructor(private readonly kind: MediaKindValue) {}

    /** Classifies a MIME type into a {@link MediaKind}. */
    static fromMime(mimeType: string): MediaKind {
        return new MediaKind(MediaKind.classify(mimeType));
    }

    /** Wraps an already-known kind value (used when rehydrating a row). */
    static of(value: MediaKindValue): MediaKind {
        return new MediaKind(value);
    }

    private static classify(mime: string): MediaKindValue {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        if (ARCHIVE_MIME_TYPES.has(mime)) return 'archive';
        return 'document';
    }

    /** The underlying kind value. */
    get value(): MediaKindValue {
        return this.kind;
    }
}
