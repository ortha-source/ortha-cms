import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { MIN_WIDTH_PERCENT, cellWidth } from '@ortha-cms/wysiwyg-core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        cellWidth: {
            /**
             * Moves width between two neighbouring columns, leaving the table
             * and every other column alone.
             */
            resizeTableColumnPair: (
                index: number,
                left: number,
                right: number
            ) => ReturnType;
            /**
             * Grows the table and the last column together, holding every other
             * column at the width it already has.
             */
            resizeTable: (
                percent: number,
                held: readonly number[]
            ) => ReturnType;
            /** Sets an attribute on every cell of one column. */
            setTableColumnAttribute: (
                index: number,
                name: string,
                value: string | number | null
            ) => ReturnType;
            /** The same, for every cell of one row. */
            setTableRowAttribute: (
                index: number,
                name: string,
                value: string | number | null
            ) => ReturnType;
        };
    }
}

/** A percentage the sanitizer would keep. */
const clamp = (percent: number): number =>
    Number(Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent)).toFixed(2));

/**
 * Column widths, as a **percentage of the table**, written on every cell of the
 * column — plus the table's own width and each cell's vertical alignment.
 *
 * TipTap's own table resizing stores a pixel `colwidth` and emits a
 * `<colgroup>`. Neither survives here: the stored HTML is rendered on a surface
 * whose measure this editor never sees, so a pixel count is a guess about
 * someone else's layout; and a column box inside the *block* box the rendered
 * table is — which is what stops a wide table widening the page — is at the
 * mercy of anonymous-table generation, where a width on the cell is honoured by
 * every layout there is.
 *
 * Repeating it down the column also costs nothing to maintain: no row operation
 * has to remember to carry it, because there is no single row that owns it.
 */
export const CellWidth = Extension.create({
    name: 'cellWidth',

    addGlobalAttributes() {
        const percentAttribute = {
            default: null,
            parseHTML: (element: HTMLElement) =>
                cellWidth(Number.parseFloat(element.style.width) || null),
            renderHTML: (attributes: Record<string, unknown>) => {
                const width = cellWidth(attributes['width']);
                return width === null ? {} : { style: `width: ${width}%` };
            }
        };

        return [
            {
                types: ['tableCell', 'tableHeader'],
                attributes: {
                    width: percentAttribute,
                    valign: {
                        default: null,
                        parseHTML: (element: HTMLElement) =>
                            element.getAttribute('data-valign'),
                        renderHTML: (attributes: Record<string, unknown>) =>
                            attributes['valign']
                                ? { 'data-valign': attributes['valign'] }
                                : {}
                    }
                }
            },
            { types: ['table'], attributes: { width: percentAttribute } }
        ];
    },

    addCommands() {
        return {
            resizeTableColumnPair:
                (index, left, right) =>
                ({ state, tr, dispatch }) => {
                    const table = tableAround(state);
                    if (!table) return false;
                    // Both sides in one transaction: what the left column
                    // gains, the right gives up, so the table holds still.
                    eachCell(state, table.pos, (pos, column) => {
                        if (column === index) {
                            tr.setNodeAttribute(pos, 'width', clamp(left));
                        } else if (column === index + 1) {
                            tr.setNodeAttribute(pos, 'width', clamp(right));
                        }
                    });
                    // A table with sized columns needs a width of its own, or
                    // the percentages are fractions of a number nobody can see.
                    if (cellWidth(table.node.attrs['width']) === null) {
                        tr.setNodeAttribute(table.pos, 'width', 100);
                    }
                    if (dispatch) dispatch(tr);
                    return true;
                },

            resizeTable:
                (percent, held) =>
                ({ state, tr, dispatch }) => {
                    const table = tableAround(state);
                    if (!table) return false;
                    tr.setNodeAttribute(table.pos, 'width', clamp(percent));
                    eachCell(state, table.pos, (pos, column) => {
                        // The last column takes whatever is left, so it must
                        // carry no width of its own — one left from an earlier
                        // drag would scale with the table like the rest, and
                        // the new room would be shared out instead of going
                        // where the cursor put it.
                        tr.setNodeAttribute(
                            pos,
                            'width',
                            column < held.length ? clamp(held[column]) : null
                        );
                    });
                    if (dispatch) dispatch(tr);
                    return true;
                },

            setTableColumnAttribute:
                (index, name, value) =>
                ({ state, tr, dispatch }) => {
                    const table = tableAround(state);
                    if (!table) return false;
                    eachCell(state, table.pos, (pos, column) => {
                        if (column === index) {
                            tr.setNodeAttribute(pos, name, value);
                        }
                    });
                    if (dispatch) dispatch(tr);
                    return true;
                },

            setTableRowAttribute:
                (index, name, value) =>
                ({ state, tr, dispatch }) => {
                    const table = tableAround(state);
                    if (!table) return false;
                    eachCell(state, table.pos, (pos, _column, row) => {
                        if (row === index)
                            tr.setNodeAttribute(pos, name, value);
                    });
                    if (dispatch) dispatch(tr);
                    return true;
                }
        };
    }
});

/** The table the selection is inside, with its document position. */
export function tableAround(
    state: EditorState
): { node: ProseMirrorNode; pos: number } | null {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === 'table') {
            return { node, pos: $from.before(depth) };
        }
    }
    return null;
}

/** Runs `visit` for every cell of the table at `tablePos`, with its grid place. */
function eachCell(
    state: EditorState,
    tablePos: number,
    visit: (pos: number, column: number, row: number) => void
): void {
    const table = state.doc.nodeAt(tablePos);
    if (!table) return;
    table.forEach((row, rowOffset, rowIndex) => {
        let column = 0;
        row.forEach((cell, cellOffset) => {
            if (
                cell.type.name !== 'tableCell' &&
                cell.type.name !== 'tableHeader'
            ) {
                return;
            }
            // +1 for the table's own opening token, +1 for the row's.
            visit(tablePos + 1 + rowOffset + 1 + cellOffset, column, rowIndex);
            column += 1;
        });
    });
}
