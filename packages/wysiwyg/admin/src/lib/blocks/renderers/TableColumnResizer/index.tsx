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
 *
 * **The last column has no grip.** Its right edge *is* the table's right edge,
 * and a sized table is pinned to the measure — so there is nothing there to
 * drag. The last column takes whatever the others leave, which is what a
 * full-width table already does.
 */
export function TableColumnResizer({
    tablePath,
    index,
    width,
    count
}: {
    tablePath: BlockPath;
    /** Which column this grip sizes. */
    index: number;
    /** The column's stored width, or `null` when it has none. */
    width: number | null;
    /** How many columns the table has — the room left to the right of this one. */
    count: number;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    const grip = useRef<HTMLButtonElement>(null);
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);

    /** The `<th>`/`<td>` this grip sits in, and the `<table>` it belongs to. */
    const elements = () => {
        const cell = grip.current?.closest<HTMLTableCellElement>('th, td');
        const table = cell?.closest('table');
        return cell && table ? { cell, table } : null;
    };

    /**
     * The widest this column may be left, so every column after it keeps at
     * least the floor. Without it, dragging the first column to 95% squashes
     * everything to its right into its own border.
     */
    const ceiling = 100 - MIN_WIDTH_PERCENT * (count - 1 - index);

    const clamp = (percent: number): number =>
        Number(
            Math.min(ceiling, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2)
        );

    const commitWidth = (percent: number | null) => {
        const found = elements();
        // Hand the elements back to React before the model redraws them, so the
        // preview and the committed value are never both in the DOM. The table
        // keeps its pinned width until the next frame: the commit makes the
        // model `sized`, which re-renders it as `w-full` — the same 100% — and
        // clearing the inline style first would show one frame of shrink-to-fit
        // on the way past.
        if (found) {
            found.cell.style.removeProperty('width');
            const table = found.table;
            requestAnimationFrame(() => table.style.removeProperty('width'));
        }
        commands.setTableColumnAttrs(tablePath, index, { width: percent });
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        // Whether the table was already pinned by the model before this press,
        // in which case a press that goes nowhere must leave it alone.
        const hasStoredWidth = found.table.classList.contains('w-full');
        // The grip is inside a `contenteditable` region's table; without this
        // the press also moves the caret, and the drag selects text.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        // The column's width **as grabbed**, before anything below moves.
        const startWidth = found.cell.getBoundingClientRect().width;

        // Pin the table to the measure, and do it *now* rather than at commit.
        //
        // A column width is a percentage *of the table*, and an unsized table
        // is only as wide as its content — so writing a width onto a cell
        // changes the very number that percentage is resolved against.
        // Measured first and pinned afterwards, which is what the commit used
        // to do, a 100px drag grew the column by 277: the fraction was taken
        // against the shrink-to-fit width and then applied to the full
        // measure, nearly twice as wide. Pinned first, the reference cannot
        // move for the length of the drag and the edge tracks the cursor 1:1.
        found.table.style.width = '100%';
        const tableWidth = found.table.getBoundingClientRect().width;
        if (tableWidth === 0) return;

        // Pinning widens the table, which would otherwise re-share the space
        // between the columns and shift the very edge being held — the grip
        // jumped ~90px out from under the cursor before the drag had begun.
        // Writing the grabbed width straight back holds that edge still and
        // lets the columns to its right take up the new room instead.
        found.cell.style.width = `${clamp((startWidth / tableWidth) * 100)}%`;

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const move = (moveEvent: PointerEvent) => {
            const next = startWidth + (moveEvent.clientX - startX);
            const percent = clamp((next / tableWidth) * 100);
            dragged.current = percent;
            found.cell.style.width = `${percent}%`;
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            if (dragged.current !== null) {
                commitWidth(dragged.current);
            } else if (!hasStoredWidth) {
                // A press that never moved changes nothing — but the table was
                // pinned on the way in, so it still has to be handed back.
                found.table.style.removeProperty('width');
            }
            dragged.current = null;
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    };

    /**
     * The same edge, from the keyboard. A drag handle reachable only by pointer
     * is a feature keyboard users simply do not have.
     */
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
                ? (found.cell.getBoundingClientRect().width /
                      found.table.getBoundingClientRect().width) *
                  100
                : MIN_WIDTH_PERCENT);
        commitWidth(clamp(current + step));
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
                // **Entirely inside its own cell.** Straddling the border is
                // the obvious choice — the pointer target should be the line
                // being aimed at — and it is wrong: half the strip then lies
                // over the *next* column, on top of it, and swallows every
                // press near that column's left edge, including its handle,
                // its menu, and the caret. A grip that hijacks its neighbour
                // is worse than one that is slightly harder to hit.
                //
                // It fits in the cell's own right padding, so it is never over
                // text either; only the line it draws reaches the border.
                'absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none',
                'before:bg-primary before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:opacity-0 before:transition-opacity',
                'hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-none'
            )}
        />
    );
}
