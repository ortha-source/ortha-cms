import {
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type Ref
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
 * One segment of a column's right-hand edge — the thing you drag to set that
 * column's width, as a **percentage of the table**, which is what gets stored
 * because the document is rendered on a surface whose measure this editor never
 * sees.
 *
 * **One segment per row, not one grip for the column.** The line has to run the
 * whole depth of the table or it reads as a tick on the header rather than as
 * the edge of a column — and the first attempt did that with a single
 * over-tall box, which was worse than it sounds: an element taller than the
 * viewport drags the whole editor whenever anything scrolls it into view, and
 * the browser does exactly that on focus. A box per row is only as tall as the
 * row it is in, so nothing ever needs scrolling, and the drag can be started
 * anywhere down the boundary rather than only from the row hosting the grip.
 *
 * The first row's segment is the labelled `<button>`; the rest are inert spans
 * with the same behavior, so a screen reader hears one control per column
 * rather than one per cell.
 *
 * It lives inside the cell rather than in an absolutely-positioned strip over
 * the table, for the same reason the row and column handles do: a strip has to
 * re-measure every column on every edit and is wrong for the frame in between,
 * where a segment parked in the cell is aligned with what it resizes by
 * construction.
 *
 * The drag previews itself by writing the width straight onto the column's
 * cells and commits once, on release — a commit per pointer-move would put a
 * hundred entries on the undo stack for one drag.
 */
export function TableColumnResizer({
    tablePath,
    index,
    width,
    labelled
}: {
    tablePath: BlockPath;
    /** Which column this segment sizes. */
    index: number;
    /** The column's stored width, or `null` when it has none. */
    width: number | null;
    /** Whether this is the segment carrying the column's accessible name. */
    labelled: boolean;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    const grip = useRef<HTMLElement>(null);
    /** The width the pointer has reached, live. Committed on release. */
    const dragged = useRef<number | null>(null);
    /**
     * Whether a drag is in flight. State rather than a ref because it is drawn:
     * the grip has to stay lit while the pointer is away from it, which is most
     * of a drag — a hover-only rule blinks it off the moment the drag starts.
     */
    const [dragging, setDragging] = useState(false);

    /**
     * Every cell of this column, and the table they are in. The preview is
     * written to all of them: a width on one row is a *hint* to the table
     * layout algorithm and which row wins is the browser's business, so setting
     * the column is the only way the preview matches what the commit stores.
     */
    const elements = () => {
        const cell = grip.current?.closest('th, td') ?? null;
        const table = cell?.closest('table') ?? null;
        const row = cell?.parentElement ?? null;
        if (!cell || !table || !row) return null;
        const at = [...row.children].indexOf(cell);
        const column = [...table.rows]
            .map((line) => line.children[at])
            .filter(
                (found): found is HTMLElement => found instanceof HTMLElement
            );
        return { cell, table, column };
    };

    const preview = (
        column: readonly HTMLElement[],
        percent: number | null
    ) => {
        for (const cell of column) {
            if (percent === null) cell.style.removeProperty('width');
            else cell.style.width = `${percent}%`;
        }
    };

    const commitWidth = (percent: number | null) => {
        const found = elements();
        // Hand the cells back to React before the model redraws them, so the
        // preview and the committed value are never both in the DOM.
        if (found) preview(found.column, null);
        commands.setTableColumnAttrs(tablePath, index, { width: percent });
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        const found = elements();
        if (!found || event.button !== 0) return;
        // The grip sits inside a `contenteditable` region's table; without this
        // the press also moves the caret, and the drag selects text.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = found.cell.getBoundingClientRect().width;
        const tableWidth = found.table.getBoundingClientRect().width;
        if (tableWidth === 0) return;

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        setDragging(true);

        const move = (moveEvent: PointerEvent) => {
            const next = startWidth + (moveEvent.clientX - startX);
            const percent = clampPercent((next / tableWidth) * 100);
            dragged.current = percent;
            preview(found.column, percent);
        };

        const end = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            setDragging(false);
            if (dragged.current !== null) commitWidth(dragged.current);
            dragged.current = null;
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    };

    /** The same edge, from the keyboard, once the grip has been focused. */
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
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

    const className = cn(
        // **Entirely inside its own cell.** It used to straddle the border, on
        // the theory that the pointer target should be the line being aimed
        // at — but half of it then lay over the *next* column, on top, and
        // stole every press near that column's left edge: its handle, its
        // menu, and the caret. A grip that hijacks its neighbour is worse than
        // one that is a little harder to hit.
        //
        // It fits in the cell's own right padding, so it is never over text
        // either. The line it draws still sits on the border, which is the
        // part the author actually aims at.
        'absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none',
        'before:bg-primary before:absolute before:inset-y-0 before:right-0 before:w-[3px] before:transition-opacity',
        // Shown, faintly, whenever the table is hovered — the same rule the row
        // and column handles follow. It used to appear only under the pointer,
        // and a grip you have to already be touching to discover is one nobody
        // finds: nothing about the table said its columns could be dragged.
        'before:opacity-0 group-hover/table:before:opacity-40',
        'hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-none',
        'data-[dragging=true]:before:opacity-100'
    );

    if (!labelled) {
        return (
            <span
                ref={grip as Ref<HTMLSpanElement>}
                aria-hidden
                data-dragging={dragging}
                onPointerDown={handlePointerDown}
                className={className}
            />
        );
    }

    return (
        <button
            ref={grip as Ref<HTMLButtonElement>}
            type="button"
            // Deliberately **not** `role="separator"`. A focusable separator is
            // the ARIA window-splitter pattern, and that pattern requires an
            // `aria-valuenow` — a number this grip does not have until a column
            // has been dragged, and would have to make up until then. A
            // labelled button promises only what it delivers.
            aria-label={intl.formatMessage(messages.label, {
                index: index + 1
            })}
            tabIndex={-1}
            data-dragging={dragging}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className={className}
        />
    );
}

/** A width the sanitizer would keep — the drag can't leave the band. */
function clampPercent(percent: number): number {
    return Number(
        Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2)
    );
}
