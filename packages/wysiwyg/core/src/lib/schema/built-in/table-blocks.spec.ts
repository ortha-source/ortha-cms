import { parseBlocks } from '../../html/parse-document';
import { serializeBlocks } from '../../html/serialize';
import { normalizeWysiwygHtml } from '../../html/normalize';
import { BLOCK_TYPE } from '../block-types';
import { isHeaderRow } from './table-blocks';

/** The blocks a fragment parses to, as a compact `type` tree. */
function shape(html: string) {
    return parseBlocks(html).map((block) => ({
        type: block.type,
        rows: block.children.map((row) => row.children.map((cell) => cell.html))
    }));
}

describe('the table block', () => {
    it('parses a header row into header cells', () => {
        const blocks = parseBlocks(
            '<table><thead><tr><th>Name</th><th>Role</th></tr></thead>' +
                '<tbody><tr><td>Ada</td><td>Engineer</td></tr></tbody></table>'
        );
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe(BLOCK_TYPE.Table);
        expect(isHeaderRow(blocks[0].children[0])).toBe(true);
        expect(isHeaderRow(blocks[0].children[1])).toBe(false);
    });

    it('round-trips a table byte-identically', () => {
        const html =
            '<table><thead><tr><th>Name</th><th>Role</th></tr></thead>' +
            '<tbody><tr><td>Ada</td><td><strong>Engineer</strong></td></tr></tbody></table>';
        expect(normalizeWysiwygHtml(html)).toBe(html);
    });

    it('emits no thead when the first row is not all headers', () => {
        const html = serializeBlocks(
            parseBlocks('<table><tr><td>a</td><td>b</td></tr></table>')
        );
        expect(html).toBe(
            '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'
        );
    });

    it('finds rows wherever they sit — tbody, tfoot, or bare', () => {
        expect(
            shape(
                '<table><tr><td>a</td></tr><tfoot><tr><td>b</td></tr></tfoot></table>'
            )
        ).toEqual([{ type: BLOCK_TYPE.Table, rows: [['a'], ['b']] }]);
    });

    it('squares up a ragged table so every row is the same width', () => {
        expect(
            shape(
                '<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td></tr></table>'
            )
        ).toEqual([
            {
                type: BLOCK_TYPE.Table,
                rows: [
                    ['a', 'b', 'c'],
                    ['d', '', '']
                ]
            }
        ]);
    });

    it('flattens block content inside a cell to inline', () => {
        expect(
            shape('<table><tr><td><p>a</p><p>b</p></td></tr></table>')
        ).toEqual([{ type: BLOCK_TYPE.Table, rows: [['ab']] }]);
    });

    it('keeps colspan and rowspan from an import, and emits neither at 1', () => {
        const html = normalizeWysiwygHtml(
            '<table><tr><td colspan="2" rowspan="1">wide</td><td>x</td></tr></table>'
        );
        expect(html).toContain('<td colspan="2">wide</td>');
        expect(html).not.toContain('rowspan');
    });

    it('drops a table with nothing in it', () => {
        expect(normalizeWysiwygHtml('<table><tbody></tbody></table>')).toBe('');
    });

    it('strips a script hiding in a cell', () => {
        expect(
            normalizeWysiwygHtml(
                '<table><tr><td>ok<script>alert(1)</script></td></tr></table>'
            )
        ).toBe('<table><tbody><tr><td>ok</td></tr></tbody></table>');
    });
});

describe('table presentation', () => {
    it("round-trips the table's own alignment", () => {
        const html =
            '<table data-align="center"><tbody><tr><td>a</td></tr></tbody></table>';
        expect(normalizeWysiwygHtml(html)).toBe(html);
    });

    it("round-trips a cell's alignment and vertical alignment", () => {
        const html =
            '<table><tbody><tr><td data-valign="middle" data-align="center">a</td>' +
            '</tr></tbody></table>';
        expect(normalizeWysiwygHtml(html)).toBe(html);
    });

    it('never writes the two defaults — they are the absence of a choice', () => {
        // `left` and `top` mean "nobody chose", so a cell aligned and then put
        // back has to serialize as one that was never touched.
        expect(
            normalizeWysiwygHtml(
                '<table><tr><td data-align="left" data-valign="top">a</td></tr></table>'
            )
        ).toBe('<table><tbody><tr><td>a</td></tr></tbody></table>');
    });

    it('drops a vertical alignment outside the vocabulary', () => {
        expect(
            normalizeWysiwygHtml(
                '<table><tr><td data-valign="baseline">a</td></tr></table>'
            )
        ).toBe('<table><tbody><tr><td>a</td></tr></tbody></table>');
    });

    it("does not let the table's alignment reach its cells", () => {
        const [table] = parseBlocks(
            '<table data-align="center"><tr><td>a</td></tr></table>'
        );
        expect(table.attrs['align']).toBe('center');
        expect(table.children[0].children[0].attrs['align']).toBeUndefined();
    });
});

describe('table column widths', () => {
    it('round-trips a width, and pins the table to the measure', () => {
        const html =
            '<table style="width: 100%"><tbody><tr>' +
            '<td style="width: 30%">a</td><td>b</td>' +
            '</tr></tbody></table>';
        expect(normalizeWysiwygHtml(html)).toBe(html);
    });

    it('reads the width back onto every cell of the column', () => {
        const [table] = parseBlocks(
            '<table><tr><td style="width: 30%">a</td><td>b</td></tr>' +
                '<tr><td style="width: 30%">c</td><td>d</td></tr></table>'
        );
        expect(table.children[0].children[0].attrs['width']).toBe(30);
        expect(table.children[1].children[0].attrs['width']).toBe(30);
        expect(table.children[0].children[1].attrs['width']).toBeUndefined();
    });

    it('gives an unsized table no width of its own', () => {
        expect(
            normalizeWysiwygHtml('<table><tr><td>a</td></tr></table>')
        ).not.toContain('style');
    });

    it('refuses a width that is not a percentage in range', () => {
        for (const width of ['480px', '0%', '120%', 'calc(50%)', '3%']) {
            expect(
                normalizeWysiwygHtml(
                    `<table><tr><td style="width: ${width}">a</td></tr></table>`
                )
            ).toBe('<table><tbody><tr><td>a</td></tr></tbody></table>');
        }
    });

    it("keeps nothing else out of a cell's style", () => {
        expect(
            normalizeWysiwygHtml(
                '<table><tr><td style="width: 30%; background: url(evil)">a</td></tr></table>'
            )
        ).toBe(
            '<table style="width: 100%"><tbody><tr>' +
                '<td style="width: 30%">a</td></tr></tbody></table>'
        );
    });
});
