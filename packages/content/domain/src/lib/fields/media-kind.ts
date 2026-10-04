/** The coarse media categories the library groups assets by. */
export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'archive';

/** Every valid {@link MediaKind} — what a media field's `accept.kinds` may name. */
export const MEDIA_KIND_VALUES: readonly MediaKind[] = [
    'image',
    'video',
    'audio',
    'document',
    'archive'
];

export const isMediaKind = (value: unknown): value is MediaKind =>
    typeof value === 'string' &&
    (MEDIA_KIND_VALUES as readonly string[]).includes(value);
