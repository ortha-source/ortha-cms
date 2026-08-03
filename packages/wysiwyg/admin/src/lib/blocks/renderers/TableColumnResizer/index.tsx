import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type { BlockPath } from '@ortha-cms/wysiwyg-core';
import { MIN_WIDTH_PERCENT } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.table.resizeColumn',
        defaultMessage: 'Resize column {index}'
    }
});

/** How many percent one arrow-key press moves a column edge. */
const KEY_STEP = 2;

/**
 * The grip on a column's right edge. Dragging it sets that column's width, as a
 * **percentage of the table** — which is what gets stored, because the document
 * is rendered on a surface whose measure this editor never sees.
 *
 * It lives inside the first row's cell rather than in an absolutely-positioned
 * strip over the table, for the same reason the row and column handles do: a
 * strip has to re-measure every column on every edit and is wrong for the frame
 * in between, where a grip parked in the cell is aligned with the thing it
 * resizes by construction.
 *
 * The drag previews itself by writing the width straight onto **its own cell**
 * and commits once, on release. Two reasons that is not a shortcut: a commit
 * per pointer-move would put a hundred entries on the undo stack for one drag,
 * and a cell's width is exactly what a table's layout algorithm propagates down
 * the column — so writing it on the one cell shows the whole column moving.
 */
export function TableColumnResizer({
    tablePath,
    index,
    width
}: {
    tablePath: BlockPath;
    /** Which column this grip sizes. */
    index: number;
    /** The column's stored width, or `null` when it has none. */
    width: number | null;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    const grip = useRef<HTMLButtonElement>(null);
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);

    /** The `<th>`/`<td>` this grip sits in, and the `<table>` it belongs to. */
    const elements = () => {
        const cell = grip.current?.closest('th, td') ?? null;
        const table = cell?.closest('table') ?? null;
        return cell && table ? { cell, table } : null;
    };

    const commitWidth = (percent: number | null) => {
        const { cell } = elements() ?? {};
        // Hand the cell back to React before the model changes it, so the
        // preview and the committed value can't both be in the DOM at once.
        if (cell instanceof HTMLElement) cell.style.removeProperty('width');
        commands.setTableColumnAttrs(tablePath, index, { width: percent });
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        // The grip is inside a `contenteditable` region's table; without this
        // the press also moves the caret, and the drag selects text.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = found.cell.getBoundingClientRect().width;
        const tableWidth = found.table.getBoundingClientRect().width;
        if (tableWidth === 0) return;

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const move = (moveEvent: PointerEvent) => {
            const next = startWidth + (moveEvent.clientX - startX);
            const percent = clampPercent((next / tableWidth) * 100);
            dragged.current = percent;
            if (found.cell instanceof HTMLElement) {
                found.cell.style.width = `${percent}%`;
            }
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            if (dragged.current !== null) commitWidth(dragged.current);
            dragged.current = null;
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    };

    /**
     * The same edge, from the keyboard. A drag handle reachable only by pointer
     * is a feature keyboard users simply don't have — and the arrow keys are
     * what a `separator` with `aria-valuenow` already promises.
     */
    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
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
                ? (found.cell.getBoundingClientRect().width /
                      found.table.getBoundingClientRect().width) *
                  100
                : MIN_WIDTH_PERCENT);
        commitWidth(clampPercent(current + step));
    };

    return (
        <button
            ref={grip}
            type="button"
            // Deliberately **not** `role="separator"`. A focusable separator is
            // the ARIA window-splitter pattern, and that pattern requires an
            // `aria-valuenow` — a number this grip does not have until a column
            // has been dragged, and would have to make up until then. A labelled
            // button promises only what it delivers.
            aria-label={intl.formatMessage(messages.label, {
                index: index + 1
            })}
            tabIndex={-1}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className={cn(
                // Straddles the border rather than sitting beside it, so the
                // pointer target is the line the author is aiming at.
                'absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize touch-none',
                'before:bg-primary before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:opacity-0 before:transition-opacity',
                'hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-none'
            )}
        />
    );
}

/** A width the sanitizer would keep — the drag can't leave the band. */
function clampPercent(percent: number): number {
    return Number(
        Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2)
    );
}
