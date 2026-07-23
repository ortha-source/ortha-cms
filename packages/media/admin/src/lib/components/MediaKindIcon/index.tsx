import type { LucideIcon } from 'lucide-react';
import { Archive, FileText, Image, Music, Video } from 'lucide-react';
import { MEDIA_KIND, type MediaKind } from '../../constants';

/** The Lucide glyph representing each asset kind. */
const KIND_ICON: Record<MediaKind, LucideIcon> = {
    [MEDIA_KIND.Image]: Image,
    [MEDIA_KIND.Video]: Video,
    [MEDIA_KIND.Audio]: Music,
    [MEDIA_KIND.Document]: FileText,
    [MEDIA_KIND.Archive]: Archive
};

/**
 * Renders the icon that stands for an asset {@link MediaKind}. A tiny shared
 * mapping so the kind glyph stays identical on tiles, list rows, and the detail
 * drawer. Decorative by default — pass `aria-hidden` context from the parent.
 */
export function MediaKindIcon({
    kind,
    className
}: {
    kind: MediaKind;
    className?: string;
}) {
    const Icon = KIND_ICON[kind];
    return <Icon className={className} aria-hidden />;
}
