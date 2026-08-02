import { normalizeWysiwygHtml } from './normalize';
import { parseBlocks } from './parse-document';
import { sanitizeHtml, sanitizeInlineHtml } from './sanitize';

describe('block alignment', () => {
    it('round-trips an alignment on every alignable type', () => {
        for (const html of [
            '<p data-align="center">a</p>',
            '<h2 data-align="right">a</h2>',
            '<blockquote data-align="center"><p>a</p></blockquote>',
            '<ul><li data-align="right">a</li></ul>',
            '<figure data-align="center"><img src="/a.png" alt="" loading="lazy"></figure>'
        ]) {
            expect(normalizeWysiwygHtml(html)).toBe(html);
        }
    });

    it('restores the alignment onto the block model', () => {
        const [block] = parseBlocks('<p data-align="justify">a</p>');
        expect(block.attrs['align']).toBe('justify');
    });

    it('never writes the left alignment — it is the absence of one', () => {
        // Round-tripping must leave a centred-then-uncentred paragraph
        // byte-identical to one nobody ever touched.
        expect(normalizeWysiwygHtml('<p data-align="left">a</p>')).toBe(
            '<p>a</p>'
        );
    });

    it('drops an alignment that is not one of the four', () => {
        expect(normalizeWysiwygHtml('<p data-align="middle">a</p>')).toBe(
            '<p>a</p>'
        );
        // The enumeration is enforced in the sanitizer, so it holds for any
        // caller — not just for content this editor produced.
        expect(sanitizeHtml('<p data-align="url(evil)">a</p>')).toBe('<p>a</p>');
    });

    it('ignores an alignment on a type that does not align', () => {
        const [block] = parseBlocks(
            '<pre data-align="center"><code>x</code></pre>'
        );
        expect(block.attrs['align']).toBeUndefined();
    });
});

describe('image sizing', () => {
    it('round-trips a size preset', () => {
        const html =
            '<figure data-size="medium"><img src="/a.png" alt="" loading="lazy"></figure>';
        expect(normalizeWysiwygHtml(html)).toBe(html);
    });

    it('never writes the full size — it is the default', () => {
        expect(
            normalizeWysiwygHtml(
                '<figure data-size="full"><img src="/a.png" alt="" loading="lazy"></figure>'
            )
        ).toBe('<figure><img src="/a.png" alt="" loading="lazy"></figure>');
    });

    it('falls back to full width for an unknown preset', () => {
        const [block] = parseBlocks(
            '<figure data-size="42px"><img src="/a.png" alt="" loading="lazy"></figure>'
        );
        expect(block.attrs['size']).toBe('full');
    });
});

describe('inline colour', () => {
    it('keeps a palette colour and its highlight', () => {
        const html =
            '<p>a <span data-color="blue">b</span> <mark data-highlight="yellow">c</mark></p>';
        expect(normalizeWysiwygHtml(html)).toBe(html);
    });

    it('survives the inline pass, which is what a block’s own text runs through', () => {
        expect(sanitizeInlineHtml('<span data-color="red">a</span>')).toBe(
            '<span data-color="red">a</span>'
        );
    });

    it('drops a colour outside the palette', () => {
        // Names, never hex — an arbitrary value is exactly the open-ended
        // styling this format exists to keep out of stored content.
        expect(
            normalizeWysiwygHtml('<p><span data-color="#f43f5e">a</span></p>')
        ).toBe('<p><span>a</span></p>');
        expect(
            normalizeWysiwygHtml('<p><mark data-highlight="chartreuse">a</mark></p>')
        ).toBe('<p><mark>a</mark></p>');
    });

    it('still refuses a style attribute alongside a colour', () => {
        expect(
            normalizeWysiwygHtml(
                '<p><span data-color="blue" style="position:fixed">a</span></p>'
            )
        ).toBe('<p><span data-color="blue">a</span></p>');
    });
});
