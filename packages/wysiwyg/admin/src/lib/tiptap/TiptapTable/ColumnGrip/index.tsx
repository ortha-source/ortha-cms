import {
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MIN_WIDTH_PERCENT } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import type { Editor } from '@tiptap/react';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.table.resizeColumn',
        defaultMessage: 'Resize column {index}'
    }
});

/** How many percent one arrow-key press moves a column edge. */
const KEY_STEP = 2;

const round = (percent: number): number => Number(percent.toFixed(2));

/**
 * The grip on a border **between two columns**. Dragging it moves width from one
 * to the other: the column on the left grows by exactly what the one on the
 * right gives up, so every other column and the table itself are untouched.
 *
 * That pairing is the whole behaviour, and it is why the drag writes *two*
 * widths rather than one. Sizing only the left column leaves the rest of the row
 * to absorb the difference between them — so a drag meant for one border quietly
 * reshuffled every column to its right, and the further ones moved most.
 *
 * Widths are stored as a **percentage of the table**, because the document is
 * rendered on a surface whose measure this editor never sees.
 *
 * **Not the last border** — that one *is* the table's right edge, and there is
 * no column to its right to take width from. It gets a `TableGrip` instead.
 */
export function ColumnGrip({
    editor,
    index,
    tableWidth,
    cellOf,
    left,
    height
}: {
    editor: Editor;
    /** The column on the **left** of this border, zero-based. */
    index: number;
    /**
     * How wide the table draws, as a percentage of the measure, or `null` when
     * it is still as wide as its content. The drag has to pin the table to this
     * exact width, and `100` is only the right answer when it has none.
     *
     * The columns themselves are measured from the DOM rather than passed in:
     * what the drag needs is the pair's width *right now*, which the layout
     * knows and the model does not — an unsized column has no stored width.
     */
    tableWidth: number | null;
    /** The first-row cell whose right border this grip is drawn on. */
    cellOf(): HTMLTableCellElement | null;
    /** Where the overlay measured that border, relative to the wrapper. */
    left: number;
    /** How tall the table is, so the grip covers the whole border. */
    height: number;
}) {
    const intl = useIntl();
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);

    /**
     * The two cells this border sits between, the table they are in, and the
     * measure that table is drawn in.
     */
    const elements = () => {
        const cell = cellOf();
        const next = cell?.nextElementSibling;
        const table = cell?.closest('table');
        const measure = table?.parentElement;
        return cell && table && measure && next instanceof HTMLTableCellElement
            ? { cell, next, table, measure }
            : null;
    };

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
    const commitPair = (grown: number, right: number, pin: number) => {
        const found = elements();
        if (found) {
            found.cell.style.width = `${grown}%`;
            found.next.style.width = `${right}%`;
            found.table.style.width = `${pin}%`;
        }
        editor.commands.resizeTableColumnPair(index, grown, right, pin);
    };

    /**
     * The width to hold the table at, as a percentage of the measure: **the one
     * it already has**.
     *
     * Not 100%. Pinning to the full measure is what a *sized* table ends up at,
     * so it looked like the safe default — but on the first drag it grew the
     * table from its content width to the whole column and handed the difference
     * to whichever column had no width yet. Dragging one border is not supposed
     * to resize the table at all, so the drag freezes it where it stands.
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
        const hasStoredWidth = tableWidth !== null;
        // The grip sits over a `contenteditable` table; without this the press
        // also moves the caret, and the drag selects text.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        // Both columns **as grabbed**, before anything below moves them.
        const startLeft = found.cell.getBoundingClientRect().width;
        const startRight = found.next.getBoundingClientRect().width;
        const pair = startLeft + startRight;

        // Pin the table to the measure, and do it *now* rather than at commit.
        //
        // A column width is a percentage *of the table*, and an unsized table is
        // only as wide as its content — so writing a width onto a cell changes
        // the very number that percentage is resolved against. Measured first
        // and pinned afterwards, which is the obvious order, a 100px drag grew
        // the column by 277: the fraction was taken against the shrink-to-fit
        // width and then applied to the full measure, nearly twice as wide.
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

        const move = (moveEvent: globalThis.PointerEvent) => {
            // The border, not the column: what the left column gains, the right
            // one gives up, so their total — and the table — hold still.
            const grown = Math.min(
                Math.max(startLeft + (moveEvent.clientX - startX), floor),
                pair - floor
            );
            const percent = asPercent(grown);
            dragged.current = percent;
            found.cell.style.width = `${percent}%`;
            found.next.style.width = `${asPercent(pair - grown)}%`;
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

    /** The same border from the keyboard, once the grip has been focused. */
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
        const before = asPercent(found.cell.getBoundingClientRect().width);
        const after = asPercent(found.next.getBoundingClientRect().width);
        const total = before + after;
        const next = Math.min(
            Math.max(before + step, MIN_WIDTH_PERCENT),
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
            type="button"
            contentEditable={false}
            // Deliberately **not** `role="separator"`. A focusable separator is
            // the ARIA window-splitter pattern, and that pattern requires an
            // `aria-valuenow` — a number this grip does not have until a column
            // has been dragged, and would have to make up until then.
            aria-label={intl.formatMessage(messages.label, { index: index + 1 })}
            tabIndex={-1}
            style={{ left: left - GRIP_WIDTH, height }}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className={cn(
                // Reaching **back into its own column**, never forward. Centred
                // on the border is the obvious choice — the pointer target
                // should be the line being aimed at — and it is wrong: half the
                // strip then lies over the *next* column and swallows every
                // press near that column's left edge, the caret included.
                'pointer-events-auto absolute top-0 z-10 w-2 cursor-col-resize touch-none',
                'before:bg-primary before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:opacity-0 before:transition-opacity',
                'hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-none'
            )}
        />
    );
}

/** How far back into its own column a grip reaches, in pixels (`w-2`). */
export const GRIP_WIDTH = 8;
