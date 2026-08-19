import {
    decodeEntities,
    htmlToPlainText,
    htmlToRichTextDocument
} from './html-to-document';
import { RICH_TEXT_MARK, RICH_TEXT_NODE, walkRichText } from './rich-text-node';

/** The node types in a parsed tree, in document order. */
const types = (html: string): string[] =>
    [...walkRichText(htmlToRichTextDocument(html))].map((node) => node.type);

describe('htmlToRichTextDocument', () => {
    it('reads headings with their level', () => {
        const doc = htmlToRichTextDocument('<h3>Intro</h3>');
        expect(doc.content?.[0]).toEqual({
            type: RICH_TEXT_NODE.Heading,
            attrs: { level: 3 },
            content: [{ type: RICH_TEXT_NODE.Text, text: 'Intro' }]
        });
    });

    it('reads a table down to its header and body cells', () => {
        expect(
            types(
                '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>'
            )
        ).toEqual([
            RICH_TEXT_NODE.Doc,
            RICH_TEXT_NODE.Table,
            RICH_TEXT_NODE.TableRow,
            RICH_TEXT_NODE.TableHeader,
            RICH_TEXT_NODE.Text,
            RICH_TEXT_NODE.TableRow,
            RICH_TEXT_NODE.TableCell,
            RICH_TEXT_NODE.Text
        ]);
    });

    it('carries a link as a mark on the text it wraps', () => {
        const doc = htmlToRichTextDocument(
            '<p>See <a href="/docs">the docs</a></p>'
        );
        const link = [...walkRichText(doc)].find((node) =>
            node.marks?.some((mark) => mark.type === RICH_TEXT_MARK.Link)
        );
        expect(link?.text).toBe('the docs');
        expect(link?.marks?.[0].attrs).toEqual({ href: '/docs' });
    });

    it('keeps a `lang` on a block as a node attribute', () => {
        const doc = htmlToRichTextDocument('<p lang="fr">Bonjour</p>');
        expect(doc.content?.[0].attrs).toEqual({ lang: 'fr' });
    });

    it('keeps a `lang` on an inline span as a language mark', () => {
        const doc = htmlToRichTextDocument(
            '<p>He said <span lang="fr">bonjour</span>.</p>'
        );
        const run = [...walkRichText(doc)].find(
            (node) => node.text === 'bonjour'
        );
        expect(run?.marks).toEqual([
            { type: RICH_TEXT_MARK.Language, attrs: { lang: 'fr' } }
        ]);
    });

    it('hoists a wrapper that carries no language', () => {
        expect(types('<div><p>Hi</p></div>')).toEqual([
            RICH_TEXT_NODE.Doc,
            RICH_TEXT_NODE.Paragraph,
            RICH_TEXT_NODE.Text
        ]);
    });

    it('drops script and style content wholesale', () => {
        expect(htmlToPlainText('<p>Hi</p><script>alert("x")</script>')).toBe(
            'Hi'
        );
    });

    it('survives unbalanced markup', () => {
        expect(htmlToPlainText('<p>One<p>Two</div>')).toBe('One Two');
    });

    it('never treats markup as text', () => {
        // The finding this whole change is about: a `maxLength` used to spend
        // the author's budget on the tags around their words.
        expect(htmlToPlainText('<p>Hello <strong>world</strong></p>')).toBe(
            'Hello world'
        );
    });

    it('separates blocks so their text does not run together', () => {
        expect(htmlToPlainText('<p>end.</p><p>Next</p>')).toBe('end. Next');
    });
});

describe('decodeEntities', () => {
    it('resolves named, decimal and hex entities', () => {
        // `&nbsp;` decodes to the character it names — a *non-breaking*
        // space (U+00A0), not an ordinary one: it is a real character the
        // author typed, and a length rule counts it as such.
        expect(decodeEntities('a &amp; b &#233; c &#xe9; d &nbsp;e')).toBe(
            'a & b \u00e9 c \u00e9 d \u00a0e'
        );
    });

    it('leaves an entity it does not know as written', () => {
        expect(decodeEntities('&clubsuit;')).toBe('&clubsuit;');
    });

    it('leaves an out-of-range code point as written', () => {
        expect(decodeEntities('&#xD800;')).toBe('&#xD800;');
    });
});
