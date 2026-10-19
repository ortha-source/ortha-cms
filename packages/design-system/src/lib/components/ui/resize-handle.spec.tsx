import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResizeHandle, type ResizeHandleProps } from './resize-handle';

/**
 * The resize handle's rules that a browser test can see only as a final width:
 * which callback a gesture ends in. A drag that should have collapsed and
 * instead committed `min` looks, on screen, like a panel that stopped at its
 * minimum — and a cancelled drag that committed looks like a drag.
 *
 * jsdom has no layout, so the pointer is driven by `clientX` alone; the test
 * setup shims pointer capture.
 */

// jsdom ships no `PointerEvent`, and without one Testing Library builds a bare
// `Event` — no `clientX`, no `pointerId`, no `button` — so every gesture below
// would read as a click at the origin. A `MouseEvent` carrying the id is all the
// handle reads.
if (typeof window.PointerEvent === 'undefined') {
    class PointerEventShim extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
            super(type, init);
            this.pointerId = init.pointerId ?? 0;
        }
    }
    window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

function setup(overrides: Partial<ResizeHandleProps> = {}) {
    const props: ResizeHandleProps = {
        value: 256,
        min: 208,
        max: 320,
        defaultValue: 256,
        edge: 'right',
        label: 'Resize sidebar',
        onPreview: vi.fn(),
        onCommit: vi.fn(),
        onResizeStart: vi.fn(),
        onResizeEnd: vi.fn(),
        ...overrides
    };
    render(
        <div style={{ position: 'relative' }}>
            <ResizeHandle {...props} />
        </div>
    );
    return { props, handle: screen.getByRole('separator') };
}

/** Down at x=500, then each of `moves`, then up (or cancel) at the last. */
function drag(
    handle: HTMLElement,
    moves: number[],
    end: 'up' | 'cancel' = 'up'
) {
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
    for (const clientX of moves) {
        fireEvent.pointerMove(handle, { pointerId: 1, clientX });
    }
    const last = moves[moves.length - 1] ?? 500;
    if (end === 'up') {
        fireEvent.pointerUp(handle, { pointerId: 1, clientX: last });
    } else {
        fireEvent.pointerCancel(handle, { pointerId: 1 });
    }
}

describe('ResizeHandle', () => {
    it('is a window splitter carrying its value and bounds', () => {
        const { handle } = setup();
        expect(handle.getAttribute('aria-orientation')).toBe('vertical');
        expect(handle.getAttribute('aria-valuenow')).toBe('256');
        expect(handle.getAttribute('aria-valuemin')).toBe('208');
        expect(handle.getAttribute('aria-valuemax')).toBe('320');
        expect(handle.tabIndex).toBe(0);
    });

    it('previews while dragging and commits once, on release, clamped [design-system:I-48]', () => {
        const { props, handle } = setup();

        drag(handle, [520, 540, 900]);

        expect(props.onPreview).toHaveBeenLastCalledWith(320);
        expect(props.onCommit).toHaveBeenCalledTimes(1);
        expect(props.onCommit).toHaveBeenCalledWith(320);
        expect(props.onResizeEnd).toHaveBeenCalledTimes(1);
    });

    it('an edge on the left grows the other way', () => {
        const { props, handle } = setup({ edge: 'left' });

        drag(handle, [470]);

        expect(props.onCommit).toHaveBeenCalledWith(286);
    });

    it('a cancelled drag commits nothing and puts the preview back [design-system:I-48]', () => {
        const { props, handle } = setup();

        drag(handle, [560], 'cancel');

        expect(props.onCommit).not.toHaveBeenCalled();
        expect(props.onPreview).toHaveBeenLastCalledWith(256);
        expect(props.onResizeEnd).toHaveBeenCalledTimes(1);
    });

    it('released past the collapse point, it collapses instead of committing the minimum [design-system:I-48]', () => {
        const onCollapse = vi.fn();
        const { props, handle } = setup({ onCollapse });

        // 256 − 200 = 56px, under half of 208.
        drag(handle, [300]);

        expect(onCollapse).toHaveBeenCalledTimes(1);
        expect(props.onCommit).not.toHaveBeenCalled();
        // Restored to the committed width first, so it reopens at it.
        expect(props.onPreview).toHaveBeenLastCalledWith(256);
    });

    it('dragged back out of the collapse point within the same gesture, it does not collapse', () => {
        const onCollapse = vi.fn();
        const { props, handle } = setup({ onCollapse });

        drag(handle, [300, 480]);

        expect(onCollapse).not.toHaveBeenCalled();
        expect(props.onCommit).toHaveBeenCalledWith(236);
    });

    it('without onCollapse, a drag past the point only stops at the minimum', () => {
        const { props, handle } = setup();

        drag(handle, [300]);

        expect(props.onCommit).toHaveBeenCalledWith(208);
    });

    it('steps from the keyboard, and Home/End jump to the bounds', () => {
        const { props, handle } = setup();

        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        expect(props.onCommit).toHaveBeenLastCalledWith(272);
        fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
        expect(props.onCommit).toHaveBeenLastCalledWith(208);
        fireEvent.keyDown(handle, { key: 'End' });
        expect(props.onCommit).toHaveBeenLastCalledWith(320);
    });

    it('Enter collapses only a collapsible panel, and leaves the key alone otherwise', () => {
        const onCollapse = vi.fn();
        const { handle } = setup({ onCollapse });
        fireEvent.keyDown(handle, { key: 'Enter' });
        expect(onCollapse).toHaveBeenCalledTimes(1);
    });

    it('double-click restores the default', () => {
        const { props, handle } = setup({ value: 300 });
        fireEvent.doubleClick(handle);
        expect(props.onCommit).toHaveBeenCalledWith(256);
    });

    it('gives the document its cursor and selection back when the drag ends', () => {
        const { handle } = setup();
        fireEvent.pointerDown(handle, {
            pointerId: 1,
            button: 0,
            clientX: 500
        });
        expect(document.documentElement.style.cursor).toBe('col-resize');

        fireEvent.pointerUp(handle, { pointerId: 1, clientX: 500 });

        expect(document.documentElement.style.cursor).toBe('');
        expect(document.documentElement.style.userSelect).toBe('');
    });
});
