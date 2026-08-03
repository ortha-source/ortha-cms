import {
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MIN_WIDTH_PERCENT, type BlockPath } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.table.resizeTable',
        defaultMessage: 'Resize table'
    }
});

/** How many percent one arrow-key press moves the table's edge. */
const KEY_STEP = 2;

/**
 * The grip on the **table's own right edge** — which is also the last column's
 * right edge, and that is exactly why it cannot resize a column.
 *
 * A column width is a percentage *of the table*, so growing the last column can
 * only take room from the others: the edge under the cursor would not move at
 * all, and everything to its left would shuffle instead. Dragging the last
 * border therefore resizes **the table**, as a percentage of the measure, and
 * the last column keeps taking whatever the other columns leave.
 *
 * Like the column grips, it previews by writing straight onto the table and
 * commits once, on release — a commit per pointer-move would put a hundred
 * entries on the undo stack for one drag.
 */
export function TableWidthResizer({
    tablePath,
    width
}: {
    tablePath: BlockPath;
    /** The table's stored width, or `null` when it is as wide as it needs. */
    width: number | null;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    const grip = useRef<HTMLButtonElement>(null);
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);

    /** The `<table>` this grip belongs to, and the measure it is drawn in. */
    const elements = () => {
        const cell = grip.current?.closest<HTMLTableCellElement>('th, td');
        const table = cell?.closest('table');
        const measure = table?.parentElement;
        return table && measure ? { table, measure } : null;
    };

    const clamp = (percent: number): number =>
        Number(Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2));

    const commitWidth = (percent: number) => {
        // **Leave the preview exactly on the committed value — never clear it.**
        // The table's width is a React `style` prop, and React only writes one
        // when its own previous value differs; clearing it by hand deleted what
        // React had just written, and the drag appeared to do nothing at all.
        elements()?.table.style.setProperty('width', `${percent}%`);
        commands.setAttrs(tablePath, { width: percent });
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        // The grip is inside a `contenteditable` region's table; without this
        // the press also moves the caret, and the drag selects text.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = found.table.getBoundingClientRect().width;
        const measure = found.measure.getBoundingClientRect().width;
        if (measure === 0) return;

        // Hold the edge exactly where it was grabbed. A table with no width of
        // its own is as wide as its content, and the first thing the drag does
        // is give it one — without writing the grabbed width back first, that
        // alone would move the edge out from under the cursor.
        found.table.style.width = `${clamp((startWidth / measure) * 100)}%`;

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const move = (moveEvent: PointerEvent) => {
            const next = startWidth + (moveEvent.clientX - startX);
            const percent = clamp((next / measure) * 100);
            dragged.current = percent;
            found.table.style.width = `${percent}%`;
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            if (dragged.current !== null) commitWidth(dragged.current);
            else if (width === null) found.table.style.removeProperty('width');
            dragged.current = null;
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    };

    /** The same edge, from the keyboard, once the grip has been focused. */
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        const step =
            event.key === 'ArrowLeft'
                ? -KEY_STEP
                : event.key === 'ArrowRight'
                  ? KEY_STEP
                  : 0;
        if (step === 0) return;
        event.preventDefault();
        const found = elements();
        const current =
            width ??
            (found
                ? (found.table.getBoundingClientRect().width /
                      found.measure.getBoundingClientRect().width) *
                  100
                : 100);
        commitWidth(clamp(current + step));
    };

    return (
        <button
            ref={grip}
            type="button"
            // A labelled button, not `role="separator"` — see the column grip:
            // the ARIA splitter pattern requires an `aria-valuenow` this has no
            // honest answer for until the table has been dragged.
            aria-label={intl.formatMessage(messages.label)}
            tabIndex={-1}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className={cn(
                // Inside the last cell, like every other grip, so it never
                // reaches past the table and over whatever sits beside it.
                'absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none',
                'before:bg-primary before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:opacity-0 before:transition-opacity',
                'hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-none'
            )}
        />
    );
}
