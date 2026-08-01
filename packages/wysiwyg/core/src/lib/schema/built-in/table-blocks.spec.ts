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
