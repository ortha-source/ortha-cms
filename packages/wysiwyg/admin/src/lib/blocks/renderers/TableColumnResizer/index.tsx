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
 * The grip on a border **between two columns**. Dragging it moves width from one
 * to the other: the column on the left grows by exactly what the one on the
 * right gives up, so every other column and the table itself are untouched.
 *
 * That pairing is the whole behaviour, and it is why the drag writes *two*
 * widths rather than one. Sizing only the left column leaves the rest of the
 * row to absorb the difference between them — so a drag meant for one border
 * quietly reshuffled every column to its right, and the further ones moved most.
 *
 * Widths are stored as a **percentage of the table**, because the document is
 * rendered on a surface whose measure this editor never sees.
 *
 * It lives inside the first row's cell rather than in an absolutely-positioned
 * strip over the table, for the same reason the row and column handles do: a
 * strip has to re-measure every column on every edit and is wrong for the frame
 * in between, where a grip parked in the cell is aligned with the thing it
 * resizes by construction.
 *
 * The drag previews by writing straight onto the two cells and commits once, on
 * release — a commit per pointer-move would put a hundred entries on the undo
 * stack for one drag.
 *
 * **Not the last border** — that one *is* the table's right edge, and there is
 * no column to its right to take width from. It gets a
 * {@link TableWidthResizer}, which grows the table and the last column together.
 */
export function TableColumnResizer({
    tablePath,
    index,
    tableWidth
}: {
    tablePath: BlockPath;
    /** The column on the **left** of this border. */
    index: number;
    /**
     * How wide the table draws, as a percentage of the measure, or `null` when
     * it is still as wide as its content. The drag has to pin the table to this
     * exact width — see {@link handlePointerDown} — and `100` is only the right
     * answer when the table has no width of its own.
     *
     * The columns themselves are measured from the DOM rather than passed in:
     * what the drag needs is the pair's width *right now*, which the layout
     * knows and the model does not (an unsized column has no stored width at
     * all).
     */
    tableWidth: number | null;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    const grip = useRef<HTMLButtonElement>(null);
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);

    /**
     * The two cells this border sits between, the table they are in, and the
     * measure that table is drawn in.
     */
    const elements = () => {
        const cell = grip.current?.closest<HTMLTableCellElement>('th, td');
        const next = cell?.nextElementSibling;
        const table = cell?.closest('table');
        const measure = table?.parentElement;
        return cell && table && measure && next instanceof HTMLTableCellElement
            ? { cell, next, table, measure }
            : null;
    };

    const round = (percent: number): number => Number(percent.toFixed(2));

    /**
     * Commits both sides of the border at once.
     *
     * **Leave the preview exactly on the committed values — never clear them.**
     * The widths are React `style` props, and React only writes one when its own
     * previous value differs. Clearing them by hand deleted what React had just
     * written and left the table with no width at all, so every column
     * percentage became a fraction of a shrink-to-fit table: an +80px drag came
     * back 5px *narrower*.
     */
    const commitPair = (left: number, right: number, pin: number) => {
        const found = elements();
        if (found) {
            found.cell.style.width = `${left}%`;
            found.next.style.width = `${right}%`;
            found.table.style.width = `${pin}%`;
        }
        commands.resizeTableColumns(
            tablePath,
            { [index]: left, [index + 1]: right },
            pin
        );
    };

    /**
     * The width to hold the table at, as a percentage of the measure: **the one
     * it already has**.
     *
     * Not 100%. Pinning to the full measure is what a *sized* table ends up at,
     * so it looked like the safe default — but on the first drag it grew the
     * table from its content width to the whole column and handed the 277px
     * difference to whichever column had no width yet. Dragging one border is
     * not supposed to resize the table at all, so the drag freezes it exactly
     * where it stands and stores that.
     */
    const pinnedWidth = (table: Element, measure: Element): number =>
        tableWidth ??
        round(
            (table.getBoundingClientRect().width /
                measure.getBoundingClientRect().width) *
                100
        );

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        // Whether the model already gives the table a width, in which case a
        // press that goes nowhere must leave the inline one alone.
        const hasStoredWidth = tableWidth !== null;
        // The grip is inside a `contenteditable` region's table; without this
        // the press also moves the caret, and the drag selects text.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        // Both columns **as grabbed**, before anything below moves them.
        const startLeft = found.cell.getBoundingClientRect().width;
        const startRight = found.next.getBoundingClientRect().width;
        const pair = startLeft + startRight;

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
        const pin = pinnedWidth(found.table, found.measure);
        found.table.style.width = `${pin}%`;
        const reference = found.table.getBoundingClientRect().width;
        if (reference === 0) return;

        // Pinning re-shares the row's space, which would shift the very border
        // being held. Writing both grabbed widths straight back holds it still
        // and lets the *other* columns take up the new room instead.
        const asPercent = (pixels: number) => round((pixels / reference) * 100);
        found.cell.style.width = `${asPercent(startLeft)}%`;
        found.next.style.width = `${asPercent(startRight)}%`;

        /** The narrowest either side of this border may be squeezed to. */
        const floor = (MIN_WIDTH_PERCENT / 100) * reference;

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const move = (moveEvent: PointerEvent) => {
            // The border, not the column: what the left column gains, the
            // right one gives up, so their total — and the table — hold still.
            const left = Math.min(
                Math.max(startLeft + (moveEvent.clientX - startX), floor),
                pair - floor
            );
            const percent = asPercent(left);
            dragged.current = percent;
            found.cell.style.width = `${percent}%`;
            found.next.style.width = `${asPercent(pair - left)}%`;
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            if (dragged.current !== null) {
                commitPair(
                    dragged.current,
                    round(asPercent(pair) - dragged.current),
                    pin
                );
            } else if (!hasStoredWidth) {
                // A press that never moved changes nothing — but the table was
                // pinned on the way in, so it still has to be handed back.
                found.table.style.removeProperty('width');
                found.cell.style.removeProperty('width');
                found.next.style.removeProperty('width');
            }
            dragged.current = null;
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    };

    /**
     * The same border, from the keyboard, once the grip has been focused. It
     * moves the same width between the same two columns.
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
        if (!found) return;
        const reference = found.table.getBoundingClientRect().width;
        if (reference === 0) return;
        const asPercent = (pixels: number) => (pixels / reference) * 100;
        const left = asPercent(found.cell.getBoundingClientRect().width);
        const right = asPercent(found.next.getBoundingClientRect().width);
        const total = left + right;
        const next = Math.min(
            Math.max(left + step, MIN_WIDTH_PERCENT),
            total - MIN_WIDTH_PERCENT
        );
        commitPair(
            round(next),
            round(total - next),
            pinnedWidth(found.table, found.measure)
        );
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
