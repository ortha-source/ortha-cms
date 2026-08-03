import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import {
    BLOCK_ALIGN,
    CELL_VALIGN,
    cellValign,
    cellWidth,
    type BlockPath,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import { useEditor } from '../../../editor/editorContext';
import { KEY } from '../../../utils/constants';
import { caretAtEnd, caretAtStart } from '../../../utils/dom-selection';
import { insertSoftBreak } from '../../../utils/marks';
import { InlineEditable, type EditableKeyHandlers } from '../../InlineEditable';
import { TableColumnResizer } from '../TableColumnResizer';

const messages = defineMessages({
    cell: {
        id: 'wysiwyg.block.table.cell',
        defaultMessage: 'Row {row}, column {column}'
    }
});

/**
 * One table cell — a real `<th>`/`<td>` with the editable inside it rather than
 * on it, so the cell keeps its table semantics and the editable keeps its
 * `role="textbox"`.
 *
 * The cell overrides four keys, because in a table they mean something else:
 * Enter must not split the block (a paragraph among the cells of a row is not a
 * table), Tab moves along the row instead of indenting, and Backspace/Delete at
 * the edges must not merge one cell into the next — every table operation
 * assumes the grid is a rectangle, and merging is how it stops being one.
 */
export function TableCellBlock({
    block,
    path,
    resizable = false
}: {
    block: WysiwygBlock;
    /** `[…tablePath, rowIndex, columnIndex]`. */
    path: BlockPath;
    /**
     * Whether this cell carries its column's resize grip. Only the first row's
     * cells do — one grip per column, parked where the author already looks for
     * the column's handles.
     */
    resizable?: boolean;
}) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const header = block.attrs['header'] === true;
    const Cell = header ? 'th' : 'td';
    const align = block.attrs['align'];
    const valign = cellValign(block.attrs['valign']);
    const width = cellWidth(block.attrs['width']);

    const keys = useMemo<EditableKeyHandlers>(
        () => ({
            [KEY.Tab]: (event) => {
                event.preventDefault();
                commands.focusTableCell(path, event.shiftKey ? -1 : 1);
                return true;
            },
            [KEY.Enter]: (event, element) => {
                if (event.shiftKey) return false;
                event.preventDefault();
                insertSoftBreak();
                commands.setHtml(path, element.innerHTML);
                return true;
            },
            [KEY.Backspace]: (event, element) => {
                if (!caretAtStart(element)) return false;
                event.preventDefault();
                return true;
            },
            [KEY.Delete]: (event, element) => {
                if (!caretAtEnd(element)) return false;
                event.preventDefault();
                return true;
            }
        }),
        [commands, path]
    );

    const [row, column] = path.slice(-2);
    return (
        <Cell
            // `colspan`/`rowspan` are round-tripped from imports rather than
            // authored here, so the editor shows the span it will write back.
            colSpan={spanOf(block.attrs['colspan'])}
            rowSpan={spanOf(block.attrs['rowspan'])}
            data-align={align ?? undefined}
            data-valign={valign ?? undefined}
            // A width the author dragged out, drawn the same way it will be
            // stored — a percentage of the table, not a pixel count.
            style={width === null ? undefined : { width: `${width}%` }}
            className={cn(
                'border-border relative border p-0 align-top',
                // The floor is what stops an empty column from collapsing to
                // its border; a column with a width has been given one on
                // purpose, and the floor would silently overrule it.
                width === null && 'min-w-24',
                header && 'bg-muted/50 font-semibold',
                header && align === undefined && 'text-left',
                ALIGN_CLASS[align as keyof typeof ALIGN_CLASS],
                VALIGN_CLASS[valign as keyof typeof VALIGN_CLASS]
            )}
        >
            <InlineEditable
                path={path}
                html={block.html}
                keys={readOnly ? undefined : keys}
                ariaLabel={intl.formatMessage(messages.cell, {
                    row: row + 1,
                    column: column + 1
                })}
                className="px-2 py-1 leading-6"
            />
            {resizable && !readOnly && (
                <TableColumnResizer
                    tablePath={path.slice(0, -2)}
                    index={column}
                    width={width}
                />
            )}
        </Cell>
    );
}

/** How the editor draws each alignment — the mirror of `WYSIWYG_PROSE`. */
const ALIGN_CLASS = {
    [BLOCK_ALIGN.Left]: 'text-left',
    [BLOCK_ALIGN.Center]: 'text-center',
    [BLOCK_ALIGN.Right]: 'text-right',
    [BLOCK_ALIGN.Justify]: 'text-justify'
} as const;

/** The same, for where the content sits in the cell's height. */
const VALIGN_CLASS = {
    [CELL_VALIGN.Top]: 'align-top',
    [CELL_VALIGN.Middle]: 'align-middle',
    [CELL_VALIGN.Bottom]: 'align-bottom'
} as const;

/** A stored span as a positive integer — 1 unless it says otherwise. */
function spanOf(value: unknown): number {
    const span = Math.floor(Number(value));
    return Number.isFinite(span) && span > 1 ? span : 1;
}
