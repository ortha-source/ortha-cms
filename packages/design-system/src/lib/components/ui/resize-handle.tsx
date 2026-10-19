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
 *   captured and the drag is followed on `window`, so it survives the cursor
 *   crossing an iframe or the rich-text editor, and it **always ends**: on the
 *   release wherever it lands, on a move that arrives with the button already
 *   up, on a lost capture, on the window losing focus, or on `Escape` (which
 *   puts the width back). For its duration `<html>` carries
 *   `data-panel-resizing`, which the design system's stylesheet turns into a
 *   resize cursor everywhere and no text selection.
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
    const [dragging, setDragging] = React.useState(false);
    const [collapsePending, setCollapsePending] = React.useState(false);

    const direction = edge === 'right' ? 1 : -1;

    // The listeners of a drag live on `window` for the drag's whole life, so
    // they read the props through a ref: the closure made at `pointerdown`
    // would otherwise keep the width and callbacks of that render.
    const latest = React.useRef({
        value,
        min,
        max,
        direction,
        onPreview,
        onCommit,
        onCollapse,
        onResizeEnd
    });
    latest.current = {
        value,
        min,
        max,
        direction,
        onPreview,
        onCommit,
        onCollapse,
        onResizeEnd
    };

    /** Ends the drag in progress, if any. Set by `pointerdown`. */
    const finish = React.useRef<
        ((outcome: 'commit' | 'cancel') => void) | null
    >(null);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        // A press that arrives while a drag is still open means its release
        // was never heard (it happened outside the window, or the capture was
        // taken away). Close that one first instead of stacking a second on
        // top of it — stacking is what used to leave the resize cursor stuck.
        finish.current?.('commit');
        event.preventDefault();

        const handle = event.currentTarget;
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startWidth = latest.current.value;
        let width = startWidth;
        let collapse = false;

        try {
            // Keeps the drag ours over an iframe or the rich-text editor.
            handle.setPointerCapture(pointerId);
        } catch {
            // A pointer the browser no longer tracks; the window listeners
            // below carry the drag regardless.
        }

        const move = (e: PointerEvent) => {
            if (e.pointerId !== pointerId) return;
            // The button is already up: the release happened somewhere this
            // drag was not told about. Never keep following a pointer the
            // user has let go of.
            if (e.buttons === 0) {
                done('commit');
                return;
            }
            const props = latest.current;
            const raw = startWidth + (e.clientX - startX) * props.direction;
            const nextCollapse =
                !!props.onCollapse && raw < props.min * COLLAPSE_RATIO;
            const next = clampWidth(raw, props.min, props.max);
            if (nextCollapse !== collapse) {
                collapse = nextCollapse;
                setCollapsePending(collapse);
            }
            if (next !== width) {
                width = next;
                props.onPreview?.(width);
            }
        };
        const up = (e: PointerEvent) => {
            if (e.pointerId === pointerId) done('commit');
        };
        const cancel = (e: PointerEvent) => {
            if (e.pointerId === pointerId) done('cancel');
        };
        // Losing the capture without a release (the handle went inert, the
        // browser took the pointer for a gesture) ends the drag where it is.
        const lost = () => done('commit');
        // Switching windows mid-drag: the release will land elsewhere.
        const blur = () => done('cancel');
        const escape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            done('cancel');
        };

        const done = (outcome: 'commit' | 'cancel') => {
            if (finish.current !== done) return;
            finish.current = null;
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', up, true);
            window.removeEventListener('pointercancel', cancel, true);
            window.removeEventListener('blur', blur);
            window.removeEventListener('keydown', escape, true);
            handle.removeEventListener('lostpointercapture', lost);
            if (handle.hasPointerCapture?.(pointerId)) {
                handle.releasePointerCapture(pointerId);
            }
            // Removed outright, never "restored": a saved value can itself be
            // the resize cursor, and restoring it is how it used to stick.
            delete document.documentElement.dataset['panelResizing'];
            setDragging(false);
            setCollapsePending(false);

            const props = latest.current;
            if (outcome === 'commit' && collapse && props.onCollapse) {
                // The preview is at `min`; put the committed width back
                // first, so the panel collapses from — and reopens at — the
                // width it had.
                props.onPreview?.(startWidth);
                props.onCollapse();
            } else if (outcome === 'commit' && width !== props.value) {
                props.onCommit(width);
            } else {
                props.onPreview?.(props.value);
            }
            props.onResizeEnd?.();
        };

        finish.current = done;
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', cancel, true);
        window.addEventListener('blur', blur);
        window.addEventListener('keydown', escape, true);
        handle.addEventListener('lostpointercapture', lost);

        // The cursor leaves the handle as soon as the drag moves. A flag on
        // the root, styled by the design system's stylesheet, keeps every
        // element showing the resize cursor and suspends text selection —
        // and clearing a flag cannot leave anything behind.
        document.documentElement.dataset['panelResizing'] = 'true';
        setDragging(true);
        onResizeStart?.();
    };

    // A drag the component did not live to finish ends with it, rather than
    // leaving the document on a resize cursor with selection off.
    React.useEffect(() => () => finish.current?.('cancel'), []);

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
            onKeyDown={handleKeyDown}
            onDoubleClick={() => commitKey(defaultValue)}
            className={cn(
                // An 8px hit area over a 2px line: wide enough to grab, and
                // the line only appears when it means something.
                'group/resize absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none select-none',
                edge === 'right' ? '-right-1' : '-left-1',
                'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors after:duration-150',
                // Hover lights the line only after a beat, the way native
                // splitters do: a pointer crossing the edge on its way
                // somewhere else should not flash it. Leaving is immediate.
                'hover:after:bg-border hover:after:delay-300 focus-visible:after:w-1 focus-visible:after:bg-ring data-[dragging]:after:bg-ring data-[dragging]:after:delay-0',
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
