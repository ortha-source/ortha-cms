import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { BlockPath, WysiwygBlock } from '@ortha-cms/wysiwyg-core';
import { useEditor } from '../../../editor/editorContext';
import { KEY } from '../../../utils/constants';
import { caretAtEnd, caretAtStart } from '../../../utils/dom-selection';
import { insertSoftBreak } from '../../../utils/marks';
import { InlineEditable, type EditableKeyHandlers } from '../../InlineEditable';

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
    path
}: {
    block: WysiwygBlock;
    /** `[…tablePath, rowIndex, columnIndex]`. */
    path: BlockPath;
}) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const header = block.attrs['header'] === true;
    const Cell = header ? 'th' : 'td';

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
            className={cn(
                'border-border min-w-24 border p-0 align-top',
                header && 'bg-muted/50 text-left font-semibold'
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
        </Cell>
    );
}

/** A stored span as a positive integer — 1 unless it says otherwise. */
function spanOf(value: unknown): number {
    const span = Math.floor(Number(value));
    return Number.isFinite(span) && span > 1 ? span : 1;
}
