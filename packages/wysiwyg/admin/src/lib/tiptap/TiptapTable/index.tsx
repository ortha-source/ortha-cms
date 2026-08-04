import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
    NodeViewContent,
    NodeViewWrapper,
    type NodeViewProps
} from '@tiptap/react';
import { BLOCK_ALIGN, cellWidth } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { ColumnGrip } from './ColumnGrip';
import { TableGrip } from './TableGrip';

/** A measured column border: where it is, and how tall the table is. */
interface Border {
    left: number;
    height: number;
}

/**
 * A table, inside a scroller of its own, with a resize grip on every border.
 *
 * The wrapper is not decoration — it is the **measure** every width in the table
 * is a percentage of. Without it the table's containing block is the writing
 * surface, whose padding sits inside its border box, so every percentage would
 * be taken against a number wider than the space the table actually has. It also
 * keeps a table wider than the column from widening the page: the overflow
 * scrolls here rather than there.
 *
 * The content element is the `<table>` and ProseMirror's own content node is a
 * `<tbody>` (`contentDOMElementTag`, set where the view is registered). Left to
 * its default the rows would be held in a `<div>` inside the table — legal to
 * build with the DOM API, and rendered through CSS's anonymous-table fixup,
 * which is not a layout anything else in the editor measures against.
 *
 * **The grips are an overlay, measured.** They used to live inside the first
 * row's cells, which kept them aligned with what they resize for free — but a
 * React node view always wraps its component in an element of its own, and no
 * element may stand between a `<tr>` and its `<td>`. Sitting over the table
 * instead means re-measuring, which is what `useLayoutEffect` and the observer
 * below are for: the borders are read after every layout the table takes part
 * in, so the grip is never a frame behind the column it belongs to.
 *
 * Centring a table is auto margins, not `text-align`, and the shared prose rules
 * put `text-align` back to `start` afterwards: without that reset the table's
 * own alignment inherits into every cell, and "centre the table" silently
 * becomes "centre everything in it".
 */
export function TiptapTable({ node, editor }: NodeViewProps) {
    const width = cellWidth(node.attrs['width']);
    const align = node.attrs['textAlign'];
    const wrapper = useRef<HTMLDivElement>(null);
    const [borders, setBorders] = useState<readonly Border[]>([]);

    /** The first row's cells — the ones the grips are drawn against. */
    const headCells = useCallback((): HTMLTableCellElement[] => {
        const row = wrapper.current?.querySelector('tbody > tr');
        return row
            ? [...row.children].filter(
                  (child): child is HTMLTableCellElement =>
                      child instanceof HTMLTableCellElement
              )
            : [];
    }, []);

    const measure = useCallback(() => {
        const box = wrapper.current?.getBoundingClientRect();
        const table = wrapper.current?.querySelector('table');
        if (!box || !table) return;
        const height = table.getBoundingClientRect().height;
        setBorders((previous) => {
            const next = headCells().map((cell) => ({
                left: cell.getBoundingClientRect().right - box.left,
                height
            }));
            // Same numbers, same array: a fresh one on every transaction would
            // re-render the grips mid-drag, which is exactly when their
            // `pointermove` listeners must not be torn down.
            return previous.length === next.length &&
                previous.every(
                    (border, at) =>
                        border.left === next[at].left &&
                        border.height === next[at].height
                )
                ? previous
                : next;
        });
    }, [headCells]);

    // After every layout the table takes part in: its own resizes (a column
    // dragged, a row added) and the surface's (the window, the rail opening).
    useLayoutEffect(() => {
        measure();
        const table = wrapper.current?.querySelector('table');
        if (!table || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(table);
        if (wrapper.current) observer.observe(wrapper.current);
        return () => observer.disconnect();
    }, [measure, node]);

    return (
        <NodeViewWrapper
            as="div"
            ref={wrapper}
            className="relative my-3 w-full overflow-x-auto"
        >
            <NodeViewContent<'table'>
                as="table"
                data-align={align ?? undefined}
                style={width === null ? undefined : { width: `${width}%` }}
                className={cn(
                    'border-border w-max border-collapse text-left',
                    align === BLOCK_ALIGN.Center && 'mx-auto',
                    align === BLOCK_ALIGN.Right && 'ml-auto'
                )}
            />

            {/* Every border drags, and the last one means something else. An
                inner border moves width from the column on its left to the one
                on its right, so the table does not change; the last border has
                no column to its right, so it grows the table and the last
                column together. */}
            {editor.isEditable && (
                <div
                    contentEditable={false}
                    className="pointer-events-none absolute inset-0"
                >
                    {borders.map((border, index) =>
                        index < borders.length - 1 ? (
                            <ColumnGrip
                                key={index}
                                editor={editor}
                                index={index}
                                tableWidth={width}
                                cellOf={() => headCells()[index] ?? null}
                                left={border.left}
                                height={border.height}
                            />
                        ) : (
                            <TableGrip
                                key={index}
                                editor={editor}
                                width={width}
                                cellOf={() => headCells()[index] ?? null}
                                left={border.left}
                                height={border.height}
                            />
                        )
                    )}
                </div>
            )}
        </NodeViewWrapper>
    );
}
