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
 *
 * **Presentation lives on the cell, and on every cell of the column.** A table
 * carries three of it: its own `data-align` (where the table sits in the
 * measure), each cell's `data-align` / `data-valign` (where the content sits in
 * the cell), and each column's width. The width is written on every cell rather
 * than once on a `<colgroup>` because the rendered table is a *block* box —
 * that is what keeps a wide table from widening the page — and a column box
 * inside a block box is at the mercy of anonymous-table generation, where a
 * width on the cell is honoured by every layout there is. Repeating it down the
 * column also costs nothing to maintain: no row operation has to remember to
 * carry it, because there is no single row that owns it.
 */

import { isElement, type HtmlElement, type HtmlNode } from '../../html/node';
import { toPercentWidth, widthFromStyle } from '../../html/sanitize';
import { createBlock } from '../../document/factory';
import type { BlockAttrs, WysiwygBlock } from '../../document/types';
import type { BlockDefinition, BlockParseContext } from '../block-definition';
import { BLOCK_GROUP, BLOCK_TYPE, CELL_VALIGN } from '../block-types';

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
    aligns: true,
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
        // A resized table is a full-measure one. Percentage cell widths are
        // resolved against the table, and a table with no width of its own is
        // as wide as its content — so "40%" would mean 40% of a number the
        // author cannot see, and would move every time they typed. Pinned to
        // the measure, the percentages mean what the drag showed them.
        const width = hasColumnWidths(block) ? ' style="width: 100%"' : '';
        return `<table${width}${ctx.align(block)}>${thead}${tbody}</table>`;
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
    // Not for the parser's sake — a cell is built by the table's `fromHtml`,
    // never by `buildBlock` — but because it is what the editor reads to decide
    // whether the alignment control is live for the block the caret is in.
    aligns: true,
    defaultAttrs: { header: false, colspan: 1, rowspan: 1 },
    toHtml: (block, ctx) => {
        const tag = block.attrs['header'] === true ? 'th' : 'td';
        // Spans are round-tripped from imports but never authored here, so they
        // are only emitted when they say something (`colspan="1"` is noise).
        const span = (name: 'colspan' | 'rowspan') => {
            const value = spanOf(block.attrs[name]);
            return value > 1 ? ` ${name}="${ctx.attr(String(value))}"` : '';
        };
        const valign = cellValign(block.attrs['valign']);
        const valignAttr = valign ? ` data-valign="${ctx.attr(valign)}"` : '';
        const width = cellWidth(block.attrs['width']);
        // The canonical spacing the sanitizer would rewrite it to, so a value
        // this serializer wrote survives a round trip byte-identically.
        const widthAttr = width === null ? '' : ` style="width: ${width}%"`;
        return `<${tag}${widthAttr}${span('colspan')}${span(
            'rowspan'
        )}${valignAttr}${ctx.align(block)}>${ctx.inline(block.html)}</${tag}>`;
    }
};

/** A cell's stored vertical alignment, or `null` when it has none. */
export function cellValign(value: unknown): string | null {
    return value === CELL_VALIGN.Middle || value === CELL_VALIGN.Bottom
        ? value
        : null;
}

/**
 * A cell's stored column width as a number of percent, or `null`.
 *
 * Run through the same parser the sanitizer uses, so the model can never hold a
 * width the HTML would refuse — the editor and the stored document agree on
 * what a width is because they ask the same function.
 */
export function cellWidth(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const percent = toPercentWidth(`${value}%`);
    return percent === null ? null : Number.parseFloat(percent);
}

/** Whether any column of `table` has been given a width. */
export function hasColumnWidths(table: WysiwygBlock): boolean {
    return table.children.some((row) =>
        row.children.some((cell) => cellWidth(cell.attrs['width']) !== null)
    );
}

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

/**
 * One `<tr>` as a row block.
 *
 * The presentational attributes are read here rather than by the parser's
 * generic `withAlign`, because a cell never passes through it — it is built by
 * the table, not matched from a tag. No validation beyond the shape: the
 * sanitize pass has already run, so `data-align` and `data-valign` are known
 * vocabulary and the width is a percentage or it is not there.
 */
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
                    rowspan: spanOf(cell.attrs['rowspan']),
                    ...presentationOf(cell)
                }
            })
        );
    return ctx.block(BLOCK_TYPE.TableRow, { children: cells });
}

/** The alignment, vertical alignment and width a `<th>`/`<td>` carries. */
function presentationOf(cell: HtmlElement): BlockAttrs {
    const align = cell.attrs['data-align'];
    const valign = cellValign(cell.attrs['data-valign']);
    const width = widthFromStyle(cell.attrs['style']);
    return {
        ...(align ? { align } : {}),
        ...(valign ? { valign } : {}),
        ...(width === null ? {} : { width })
    };
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
