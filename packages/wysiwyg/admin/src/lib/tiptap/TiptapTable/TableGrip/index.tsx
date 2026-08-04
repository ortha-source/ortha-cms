import {
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MIN_WIDTH_PERCENT } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import type { Editor } from '@tiptap/react';
import { GRIP_WIDTH } from '../ColumnGrip';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.table.resizeTable',
        defaultMessage: 'Resize table'
    }
});

/** How many percent one arrow-key press moves the table's edge. */
const KEY_STEP = 2;

const clamp = (percent: number): number =>
    Number(Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2));
const round = (percent: number): number => Number(percent.toFixed(2));

/**
 * The grip on the **table's own right edge**, which is also the last column's.
 * Dragging it grows the table *and* the last column together — there is no
 * column to the right to take width from, so the room has to come from the
 * measure instead.
 *
 * Only the last column moves. The other columns are **pinned in place for the
 * length of the drag**, and that is not free: a column width is a percentage of
 * the table, so holding one at a fixed number of pixels while the table grows
 * means rewriting its percentage on every frame. Left alone they would each take
 * a share of the new room, and dragging one border would silently widen every
 * column in the table.
 */
export function TableGrip({
    editor,
    width,
    cellOf,
    left,
    height
}: {
    editor: Editor;
    /** The table's stored width, or `null` when it is as wide as it needs. */
    width: number | null;
    /** The last cell of the first row, from which the table is reached. */
    cellOf(): HTMLTableCellElement | null;
    /** Where the overlay measured the table's right edge. */
    left: number;
    height: number;
}) {
    const intl = useIntl();
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);

    /**
     * The table, the measure it is drawn in, and every cell of the first row
     * **to the left** of the grip — the ones that have to be held still.
     */
    const elements = () => {
        const cell = cellOf();
        const table = cell?.closest('table');
        const measure = table?.parentElement;
        const row = cell?.parentElement;
        if (!cell || !table || !measure || !row) return null;
        const columns = [...row.children].filter(
            (child): child is HTMLTableCellElement =>
                child instanceof HTMLTableCellElement
        );
        return {
            table,
            measure,
            held: columns.slice(0, -1),
            last: columns[columns.length - 1] ?? null
        };
    };

    /**
     * Commits the table's width and the columns held still beneath it, in one
     * edit.
     *
     * **Leave the preview exactly on the committed values — never clear them.**
     * They are React `style` props, and React only writes one when its own
     * previous value differs; clearing them by hand deleted what React had just
     * written, and the drag appeared to do nothing at all.
     */
    const commitWidth = (percent: number, held: readonly number[]) => {
        const found = elements();
        if (found) {
            found.table.style.width = `${percent}%`;
            held.forEach((column, at) => {
                const cell = found.held[at];
                if (cell) cell.style.width = `${column}%`;
            });
            found.last?.style.removeProperty('width');
        }
        editor.commands.resizeTable(percent, held);
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = found.table.getBoundingClientRect().width;
        const measure = found.measure.getBoundingClientRect().width;
        if (measure === 0) return;
        // What every other column measures right now, in pixels. These are the
        // widths that must not change, whatever the table does.
        const heldPixels = found.held.map(
            (cell) => cell.getBoundingClientRect().width
        );

        // Hold the edge exactly where it was grabbed. A table with no width of
        // its own is as wide as its content, and the first thing the drag does
        // is give it one — without writing the grabbed width back first, that
        // alone would move the edge out from under the cursor.
        found.table.style.width = `${clamp((startWidth / measure) * 100)}%`;
        // The last column is the one that grows, so it gives up any width it was
        // holding and takes the remainder for the length of the drag.
        found.last?.style.removeProperty('width');

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        /**
         * The held columns as percentages of a table `pixels` wide.
         *
         * Clamped to the floor, because holding a column at a fixed pixel width
         * while the table grows makes its *percentage* fall — and one that slips
         * under the floor is a width the sanitizer refuses, so the column came
         * back with no stored width at all and snapped out to its minimum,
         * shoving everything else along with it.
         */
        const heldAt = (pixels: number) =>
            heldPixels.map((held) =>
                round(Math.max(MIN_WIDTH_PERCENT, (held / pixels) * 100))
            );

        const move = (moveEvent: globalThis.PointerEvent) => {
            const next = startWidth + (moveEvent.clientX - startX);
            const percent = clamp((next / measure) * 100);
            dragged.current = percent;
            found.table.style.width = `${percent}%`;
            // A percentage of a table that just changed size is a different
            // number of pixels, so every held column is re-stated each frame.
            // Skipping this is what let one border widen the whole row.
            const pixels = (percent / 100) * measure;
            heldAt(pixels).forEach((column, at) => {
                found.held[at].style.width = `${column}%`;
            });
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            if (dragged.current !== null) {
                commitWidth(
                    dragged.current,
                    heldAt((dragged.current / 100) * measure)
                );
            } else if (width === null) {
                found.table.style.removeProperty('width');
            }
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
        if (!found) return;
        const measure = found.measure.getBoundingClientRect().width;
        if (measure === 0) return;
        const current =
            width ?? (found.table.getBoundingClientRect().width / measure) * 100;
        const percent = clamp(current + step);
        const pixels = (percent / 100) * measure;
        commitWidth(
            percent,
            found.held.map((cell) =>
                round(
                    Math.max(
                        MIN_WIDTH_PERCENT,
                        (cell.getBoundingClientRect().width / pixels) * 100
                    )
                )
            )
        );
    };

    return (
        <button
            type="button"
            contentEditable={false}
            // A labelled button, not `role="separator"` — see the column grip:
            // the ARIA splitter pattern requires an `aria-valuenow` this has no
            // honest answer for until the table has been dragged.
            aria-label={intl.formatMessage(messages.label)}
            tabIndex={-1}
            style={{ left: left - GRIP_WIDTH, height }}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className={cn(
                'pointer-events-auto absolute top-0 z-10 w-2 cursor-col-resize touch-none',
                'before:bg-primary before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:opacity-0 before:transition-opacity',
                'hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-none'
            )}
        />
    );
}
