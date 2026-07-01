import { Play } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import { MEDIA_KIND } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import { assetGradient } from '../../utils/assetGradient';
import { formatDuration } from '../../utils/formatDuration';
import { MediaKindIcon } from '../MediaKindIcon';

/**
 * The visual preview for an asset — a deterministic gradient tile (a
 * self-contained stand-in for a real thumbnail, so the mockup needs no image
 * files or network). Non-image kinds get a large centred kind glyph; video/audio
 * get a play affordance and a duration pill. Sized entirely by the parent via
 * `className` (aspect + radius), so it serves tiles, list rows, and the drawer.
 */
export function MediaThumbnail({
    asset,
    className,
    iconClassName
}: {
    asset: MediaAsset;
    className?: string;
    iconClassName?: string;
}) {
    const isImage = asset.kind === MEDIA_KIND.Image;
    const isPlayable =
        asset.kind === MEDIA_KIND.Video || asset.kind === MEDIA_KIND.Audio;

    return (
        <div
            className={cn(
                'relative flex items-center justify-center overflow-hidden bg-muted',
                className
            )}
            style={{ backgroundImage: assetGradient(asset.id) }}
        >
            {/* A soft wash so overlaid glyphs stay legible on any hue. */}
            <div className="absolute inset-0 bg-black/5" aria-hidden />
            {isImage ? null : (
                <MediaKindIcon
                    kind={asset.kind}
                    className={cn(
                        'relative size-8 text-white/90 drop-shadow-sm',
                        iconClassName
                    )}
                />
            )}
            {isPlayable ? (
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
                    <Play className="size-3 fill-current" aria-hidden />
                    {asset.duration ? formatDuration(asset.duration) : null}
                </span>
            ) : null}
        </div>
    );
}
