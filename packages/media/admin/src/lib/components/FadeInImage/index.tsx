import { useLayoutEffect, useRef, useState } from 'react';
import type { ImgHTMLAttributes, SyntheticEvent } from 'react';
import { cn } from '@orthacms/design-system';

/** Props for {@link FadeInImage} — a plain `<img>`'s, `src` required. */
export type FadeInImageProps = ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
};

/**
 * An `<img>` that fades in once its bytes have arrived, instead of painting
 * top-down over the tile. Whatever sits behind it (the tile's gradient or
 * muted fill) is the placeholder, so nothing shifts when it lands.
 *
 * Two cases would otherwise leave it invisible for good:
 *
 * - **A cached image** can finish before React attaches `onLoad`, so the event
 *   never reaches us. It is already `complete` on mount, which the layout
 *   effect reads before the first paint — no fade, no flash.
 * - **A broken image** never fires `load`. `error` reveals it too: the alt text
 *   (and the browser's broken-image glyph) is information, an empty tile is not.
 *
 * Visibility is keyed on the `src` that settled, so a tile reused for a
 * different asset starts hidden again rather than showing the new image
 * half-drawn. Reduced motion skips the fade, not the image.
 */
export function FadeInImage({
    src,
    className,
    onLoad,
    onError,
    alt,
    ...props
}: FadeInImageProps) {
    const ref = useRef<HTMLImageElement>(null);
    const [settledSrc, setSettledSrc] = useState<string | null>(null);

    useLayoutEffect(() => {
        if (ref.current?.complete) setSettledSrc(src);
    }, [src]);

    const settle =
        (handler?: (event: SyntheticEvent<HTMLImageElement>) => void) =>
        (event: SyntheticEvent<HTMLImageElement>) => {
            setSettledSrc(src);
            handler?.(event);
        };

    const visible = settledSrc === src;

    return (
        <img
            {...props}
            ref={ref}
            src={src}
            alt={alt}
            onLoad={settle(onLoad)}
            onError={settle(onError)}
            data-loaded={visible ? 'true' : 'false'}
            className={cn(
                'transition-opacity duration-(--ds-duration-base) ease-(--ds-ease-out) motion-reduce:transition-none',
                visible ? 'opacity-100' : 'opacity-0',
                className
            )}
        />
    );
}
