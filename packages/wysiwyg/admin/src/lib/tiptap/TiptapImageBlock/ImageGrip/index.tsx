import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MIN_WIDTH_PERCENT } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';

const messages = defineMessages({
    left: {
        id: 'wysiwyg.block.image.resizeLeft',
        defaultMessage: 'Resize image from the left'
    },
    right: {
        id: 'wysiwyg.block.image.resizeRight',
        defaultMessage: 'Resize image from the right'
    }
});

/** How many percent one arrow-key press moves the edge. */
const KEY_STEP = 5;

/**
 * One of the two grips on a picture's edges. Dragging either sets the image's
 * width as a **percentage of the measure**, which is what the presets are too —
 * the same choice at a resolution the buttons can't offer, stored the same way,
 * because the document is rendered on a surface whose width this editor never
 * sees.
 *
 * There is a grip on each side rather than one, because an image aligned right
 * grows leftwards and a handle that only ever reaches away from the picture is
 * one the author has to think about. Both write the same attribute; the side
 * only decides which direction counts as wider.
 */
export function ImageGrip({
    side,
    width,
    onResize
}: {
    side: 'left' | 'right';
    /** The picture's stored custom width, or `null` when it is on a preset. */
    width: number | null;
    onResize(percent: number): void;
}) {
    const intl = useIntl();
    const grip = useRef<HTMLButtonElement>(null);
    const dragged = useRef<number | null>(null);

    /** The `<figure>` this grip belongs to, and the measure it is drawn in. */
    const elements = () => {
        const figure = grip.current?.closest('figure') ?? null;
        const measure = figure?.parentElement ?? null;
        return figure && measure ? { figure, measure } : null;
    };

    const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = found.figure.getBoundingClientRect().width;
        const measure = found.measure.getBoundingClientRect().width;
        if (measure === 0) return;

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const move = (moveEvent: globalThis.PointerEvent) => {
            const travelled = moveEvent.clientX - startX;
            const next =
                startWidth + (side === 'right' ? travelled : -travelled);
            const percent = clampPercent((next / measure) * 100);
            dragged.current = percent;
            // Previewed on the element for the length of the drag, so the
            // undo stack gets one entry rather than one per `pointermove`.
            found.figure.style.width = `${percent}%`;
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            // The preview is deliberately *not* cleared: the width is a React
            // `style` prop, and React writes one only when its own previous
            // value differs — clearing by hand deletes what the commit is
            // about to render and leaves the picture with no width at all.
            if (dragged.current !== null) onResize(dragged.current);
            dragged.current = null;
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    };

    /** The same edge from the keyboard — a pointer-only handle is no handle. */
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const towards =
            event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (towards === 0) return;
        event.preventDefault();
        const found = elements();
        const current =
            width ??
            (found
                ? (found.figure.getBoundingClientRect().width /
                      found.measure.getBoundingClientRect().width) *
                  100
                : 100);
        const step = side === 'right' ? towards : -towards;
        onResize(clampPercent(current + step * KEY_STEP));
    };

    return (
        <button
            ref={grip}
            type="button"
            // A labelled button, not `role="separator"` — the splitter pattern
            // requires an `aria-valuenow` this has no honest answer for until
            // the picture has been dragged, and axe is right to ask for it.
            aria-label={intl.formatMessage(messages[side])}
            tabIndex={-1}
            contentEditable={false}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className={cn(
                'absolute inset-y-0 z-10 flex w-4 touch-none cursor-ew-resize items-center justify-center',
                side === 'right' ? '-right-2' : '-left-2',
                'opacity-0 transition-opacity group-hover/image:opacity-100 focus-visible:opacity-100 focus-visible:outline-none'
            )}
        >
            <span
                aria-hidden
                className="bg-primary border-background h-10 w-1.5 rounded-full border shadow-sm"
            />
        </button>
    );
}

/** A width the sanitizer would keep — the drag can't leave the band. */
function clampPercent(percent: number): number {
    return Number(
        Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2)
    );
}
