/**
 * The table block types — `table` › `tableRow` › `tableCell`.
 *
 * A table is **three nested block types, not one block with a grid attribute**.
 * `BlockAttrs` holds JSON scalars only, so a 2-D array of cells could not live
 * there; but more importantly a cell is a place a caret goes, and every editable
 * region in this editor is a block. Modelling rows and cells as blocks means
 * they get paths, ids, and the existing tree operations for free, and the
 * renderer can put an `InlineEditable` in each cell with no new machinery.
 *
 * **Header-ness lives on the cell**, not on the table. `<th>` versus `<td>` is a
 * property of the cell in the HTML, so storing it there is the only shape that
 * round-trips an imported table faithfully; the `<thead>` wrapper is *derived*
 * on the way out (a first row whose cells are all headers), never stored.
 *
 * Rows and cells deliberately declare **no `tags`**: they are built by the
 * table's own `fromHtml`, so a stray `<tr>` outside a table can't parse into an
 * orphan row block that nothing knows how to render.
 */

import { isElement, type HtmlElement, type HtmlNode } from '../../html/node';
import { createBlock } from '../../document/factory';
import type { WysiwygBlock } from '../../document/types';
import type { BlockDefinition, BlockParseContext } from '../block-definition';
import { BLOCK_GROUP, BLOCK_TYPE } from '../block-types';

/** Whether a row is a header row — every cell in it is a `<th>`. */
export function isHeaderRow(row: WysiwygBlock | undefined): boolean {
    if (!row || row.children.length === 0) return false;
    return row.children.every((cell) => cell.attrs['header'] === true);
}

/** An empty cell. */
export function createTableCell(header = false): WysiwygBlock {
    return createBlock(BLOCK_TYPE.TableCell, {
        attrs: { header, colspan: 1, rowspan: 1 }
    });
}

/** An empty row, `width` cells wide. */
export function createTableRow(width: number, header = false): WysiwygBlock {
    return createBlock(BLOCK_TYPE.TableRow, {
        children: Array.from({ length: Math.max(1, width) }, () =>
            createTableCell(header)
        )
    });
}

/** A blank table: a header row plus `rows` body rows. */
export function createTable(rows = 2, columns = 3): WysiwygBlock {
    return createBlock(BLOCK_TYPE.Table, {
        children: [
            createTableRow(columns, true),
            ...Array.from({ length: Math.max(1, rows) }, () =>
                createTableRow(columns)
            )
        ]
    });
}

/** A grid: rows of cells, all rows the same width. */
export const tableBlock: BlockDefinition = {
    type: BLOCK_TYPE.Table,
    content: 'container',
    tags: ['table'],
    descriptor: {
        defaultLabel: 'Table',
        keywords: ['table', 'grid', 'rows', 'columns', 'spreadsheet'],
        group: BLOCK_GROUP.Advanced,
        order: 23
    },
    toHtml: (block, ctx) => {
        const rows = block.children;
        // `<thead>` is derived, not stored: it is exactly "the first row, when
        // all of its cells are headers".
        const head = isHeaderRow(rows[0]) ? rows[0] : null;
        const body = head ? rows.slice(1) : rows;
        const thead = head ? `<thead>${ctx.children([head])}</thead>` : '';
        const tbody =
            body.length > 0 ? `<tbody>${ctx.children(body)}</tbody>` : '';
        return `<table>${thead}${tbody}</table>`;
    },
    fromHtml: (element, ctx) => {
        const rows = collectRows(element).map((row) => rowFrom(row, ctx));
        const filled = rows.filter((row) => row.children.length > 0);
        if (filled.length === 0) return null;
        return ctx.block(BLOCK_TYPE.Table, { children: squared(filled, ctx) });
    }
};

/** One row of a {@link tableBlock}. Holds only cells. */
export const tableRowBlock: BlockDefinition = {
    type: BLOCK_TYPE.TableRow,
    content: 'container',
    toHtml: (block, ctx) => `<tr>${ctx.children(block.children)}</tr>`
};

/** One cell. Holds inline text — a cell is a phrase, not a document. */
export const tableCellBlock: BlockDefinition = {
    type: BLOCK_TYPE.TableCell,
    content: 'inline',
    defaultAttrs: { header: false, colspan: 1, rowspan: 1 },
    toHtml: (block, ctx) => {
        const tag = block.attrs['header'] === true ? 'th' : 'td';
        // Spans are round-tripped from imports but never authored here, so they
        // are only emitted when they say something (`colspan="1"` is noise).
        const span = (name: 'colspan' | 'rowspan') => {
            const value = spanOf(block.attrs[name]);
            return value > 1 ? ` ${name}="${ctx.attr(String(value))}"` : '';
        };
        return `<${tag}${span('colspan')}${span('rowspan')}>${ctx.inline(
            block.html
        )}</${tag}>`;
    }
};

/**
 * Every `<tr>` under a table, in document order — walking through whatever
 * sits between (`<thead>`, `<tbody>`, `<tfoot>`, or nothing at all, which is
 * what an unwrapped `<tfoot>` leaves behind).
 */
function collectRows(element: HtmlElement): HtmlElement[] {
    const rows: HtmlElement[] = [];
    const walk = (nodes: readonly HtmlNode[]) => {
        for (const node of nodes) {
            if (!isElement(node)) continue;
            if (node.tag === 'tr') rows.push(node);
            else walk(node.children);
        }
    };
    walk(element.children);
    return rows;
}

/** One `<tr>` as a row block. */
function rowFrom(row: HtmlElement, ctx: BlockParseContext): WysiwygBlock {
    const cells = row.children
        .filter(
            (node): node is HtmlElement =>
                isElement(node) && (node.tag === 'th' || node.tag === 'td')
        )
        .map((cell) =>
            ctx.block(BLOCK_TYPE.TableCell, {
                // A cell's content is flattened to inline: a `<p>` inside a
                // `<td>` is the same sentence, and keeping it would make the
                // cell a container the renderer has no caret for.
                html: ctx.inline(cell.children),
                attrs: {
                    header: cell.tag === 'th',
                    colspan: spanOf(cell.attrs['colspan']),
                    rowspan: spanOf(cell.attrs['rowspan'])
                }
            })
        );
    return ctx.block(BLOCK_TYPE.TableRow, { children: cells });
}

/**
 * Pads every row out to the widest one. Imported tables are routinely ragged
 * (a row short of a cell, a `colspan` standing in for two), and every column
 * operation in the editor assumes a rectangle — squaring up once here is far
 * cheaper than making each of them defensive.
 */
function squared(
    rows: readonly WysiwygBlock[],
    ctx: BlockParseContext
): WysiwygBlock[] {
    const width = Math.max(...rows.map((row) => row.children.length));
    return rows.map((row) => {
        if (row.children.length === width) return row;
        const header = isHeaderRow(row);
        const padding = Array.from(
            { length: width - row.children.length },
            () => ctx.block(BLOCK_TYPE.TableCell, { attrs: { header } })
        );
        return { ...row, children: [...row.children, ...padding] };
    });
}

/** A `colspan`/`rowspan` as a positive integer, defaulting to 1. */
function spanOf(value: unknown): number {
    const span = Math.floor(Number(value));
    return Number.isFinite(span) && span > 1 ? span : 1;
}
