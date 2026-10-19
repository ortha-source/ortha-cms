import * as React from 'react';

import { cn } from '../../utils';

/** How far one arrow key resizes, in pixels. */
const STEP = 16;

/** How far `Shift` + arrow resizes. */
const BIG_STEP = 64;

/**
 * Dragged below this fraction of its minimum, a collapsible panel collapses on
 * release. Half the minimum is far enough past the stop that nobody collapses a
 * panel by overshooting it, and near enough that the gesture is discoverable.
 */
export const COLLAPSE_RATIO = 0.5;

/** Clamps `value` into `[min, max]`. */
export function clampWidth(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), Math.max(min, max));
}

/** Props for {@link ResizeHandle}. */
export type ResizeHandleProps = {
    /** The panel's current, committed width in pixels. */
    value: number;
    /** Narrowest width the drag or the keys can reach. */
    min: number;
    /** Widest width the drag or the keys can reach. */
    max: number;
    /** Width a double-click restores. */
    defaultValue: number;
    /**
     * Which edge of the panel the handle sits on — `right` for a panel on the
     * left of what it resizes against (dragging right widens it), `left` for
     * one on the right.
     */
    edge: 'left' | 'right';
    /** Accessible name — "Resize sidebar". The design system carries no i18n, so pass it translated. */
    label: string;
    /** `id` of the panel, for `aria-controls`. */
    controls?: string;
    /**
     * Shows a width mid-drag, without committing it. Called on every pointer
     * move, so it should touch the DOM (a CSS variable) rather than React state
     * — committing on each move would re-render whatever owns the panel at the
     * pointer's rate.
     */
    onPreview?: (width: number) => void;
    /** Commits a width — the end of a drag, a key, a double-click. */
    onCommit: (width: number) => void;
    /**
     * Collapses the panel. Given, the panel is collapsible: a drag released
     * far enough below `min` (see {@link COLLAPSE_RATIO}) collapses it instead
     * of stopping at `min`, and `Enter` collapses it from the keyboard.
     */
    onCollapse?: () => void;
    /** A drag began. */
    onResizeStart?: () => void;
    /** A drag ended — committed, collapsed or cancelled. */
    onResizeEnd?: () => void;
    className?: string;
};

/**
 * The grip on a resizable panel's edge — a WAI-ARIA **window splitter**: a
 * focusable `separator` carrying the width as its value, so a keyboard user can
 * resize as well as a pointer can.
 *
 * - **Pointer:** drag to resize between `min` and `max`. The pointer is
 *   captured, so the drag survives the cursor crossing an iframe or the rich
 *   text editor, and text selection is suspended for its duration.
 * - **Keys:** `←`/`→` step by 16px (64px with `Shift`), `Home`/`End` jump to
 *   `min`/`max`, `Enter` collapses a collapsible panel.
 * - **Double-click** restores `defaultValue`.
 *
 * It positions itself `absolute` on the chosen edge, so its parent must be
 * positioned. It does not hide itself on a phone — a panel that becomes an
 * overlay there simply should not render one.
 */
export function ResizeHandle({
    value,
    min,
    max,
    defaultValue,
    edge,
    label,
    controls,
    onPreview,
    onCommit,
    onCollapse,
    onResizeStart,
    onResizeEnd,
    className
}: ResizeHandleProps) {
    const drag = React.useRef<{
        pointerId: number;
        startX: number;
        startWidth: number;
        width: number;
        collapse: boolean;
        restore: () => void;
    } | null>(null);
    const [dragging, setDragging] = React.useState(false);
    const [collapsePending, setCollapsePending] = React.useState(false);

    const direction = edge === 'right' ? 1 : -1;

    const end = (outcome: 'commit' | 'cancel') => {
        const current = drag.current;
        if (!current) return;
        drag.current = null;
        current.restore();
        setDragging(false);
        setCollapsePending(false);
        if (outcome === 'commit' && current.collapse && onCollapse) {
            // The preview is at `min`; put the committed width back first, so
            // the panel collapses from — and reopens at — the width it had.
            onPreview?.(current.startWidth);
            onCollapse();
        } else if (outcome === 'commit' && current.width !== value) {
            onCommit(current.width);
        } else {
            onPreview?.(value);
        }
        onResizeEnd?.();
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);

        // The cursor leaves the handle as soon as the drag moves; pinning it on
        // the root keeps it a resize cursor, and suspending selection keeps the
        // drag from highlighting half the page.
        const root = document.documentElement;
        const previousCursor = root.style.cursor;
        const previousSelect = root.style.userSelect;
        root.style.cursor = 'col-resize';
        root.style.userSelect = 'none';

        drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: value,
            width: value,
            collapse: false,
            restore: () => {
                root.style.cursor = previousCursor;
                root.style.userSelect = previousSelect;
            }
        };
        setDragging(true);
        onResizeStart?.();
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const raw =
            current.startWidth + (event.clientX - current.startX) * direction;
        const collapse = !!onCollapse && raw < min * COLLAPSE_RATIO;
        const width = clampWidth(raw, min, max);
        if (collapse !== current.collapse) {
            current.collapse = collapse;
            setCollapsePending(collapse);
        }
        if (width !== current.width) {
            current.width = width;
            onPreview?.(width);
        }
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        end('commit');
    };

    const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        end('cancel');
    };

    // A drag the component did not live to finish must not leave the whole
    // document stuck on a resize cursor with selection off.
    React.useEffect(() => () => drag.current?.restore(), []);

    const commitKey = (width: number) => {
        const next = clampWidth(width, min, max);
        if (next !== value) onCommit(next);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? BIG_STEP : STEP;
        switch (event.key) {
            case 'ArrowRight':
                commitKey(value + step * direction);
                break;
            case 'ArrowLeft':
                commitKey(value - step * direction);
                break;
            case 'Home':
                commitKey(min);
                break;
            case 'End':
                commitKey(max);
                break;
            case 'Enter':
                if (!onCollapse) return;
                onCollapse();
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-controls={controls}
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={0}
            data-slot="resize-handle"
            data-edge={edge}
            data-dragging={dragging || undefined}
            data-collapse-pending={collapsePending || undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => commitKey(defaultValue)}
            className={cn(
                // An 8px hit area over a 2px line: wide enough to grab, and
                // the line only appears when it means something.
                'group/resize absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none select-none',
                edge === 'right' ? '-right-1' : '-left-1',
                'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors after:duration-150',
                'hover:after:bg-border focus-visible:after:w-1 focus-visible:after:bg-ring data-[dragging]:after:bg-ring',
                // Past the collapse point the line dims: let go and it goes.
                'data-[collapse-pending]:after:bg-muted-foreground/40',
                // Forced colours drop background colours, and with them the
                // only focus indicator this control has.
                'forced-colors:focus-visible:after:bg-[Highlight]',
                className
            )}
        />
    );
}
