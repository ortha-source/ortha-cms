import { richTextToHtml } from './document-to-html';
import { htmlToRichTextDocument } from './html-to-document';
import { RICH_TEXT_NODE } from './rich-text-node';

/** HTML → document → HTML, the round trip a stored body makes. */
const roundTrip = (html: string): string =>
    richTextToHtml(htmlToRichTextDocument(html));

describe('richTextToHtml', () => {
    it('serializes blocks, marks and links', () => {
        expect(roundTrip('<p>Hello <strong>world</strong></p>')).toBe(
            '<p>Hello <strong>world</strong></p>'
        );
        expect(roundTrip('<p><a href="/docs">the docs</a></p>')).toBe(
            '<p><a href="/docs" rel="noopener noreferrer nofollow">the docs</a></p>'
        );
    });

    it('keeps every language marker', () => {
        // 504.2.1: a language of parts that does not survive serialization was
        // never really expressible.
        expect(roundTrip('<p lang="fr">Bonjour</p>')).toBe(
            '<p lang="fr">Bonjour</p>'
        );
        expect(
            roundTrip('<p>He said <span lang="fr">bonjour</span>.</p>')
        ).toBe('<p>He said <span lang="fr">bonjour</span>.</p>');
    });

    it('gives every header cell the scope that associates it', () => {
        expect(roundTrip('<table><tr><th>A</th></tr></table>')).toBe(
            '<table><tr><th scope="col">A</th></tr></table>'
        );
    });

    it('escapes text rather than emitting it as markup', () => {
        expect(
            richTextToHtml({
                type: RICH_TEXT_NODE.Doc,
                content: [
                    {
                        type: RICH_TEXT_NODE.Paragraph,
                        content: [
                            {
                                type: RICH_TEXT_NODE.Text,
                                text: '<img src=x onerror=alert(1)>'
                            }
                        ]
                    }
                ]
            })
        ).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    });

    it('drops an href that would execute rather than navigate', () => {
        expect(
            richTextToHtml({
                type: RICH_TEXT_NODE.Doc,
                content: [
                    {
                        type: RICH_TEXT_NODE.Text,
                        text: 'x',
                        marks: [
                            {
                                type: 'link',
                                attrs: { href: 'javascript:alert(1)' }
                            }
                        ]
                    }
                ]
            })
        ).toBe('x');
    });

    it('emits an unknown node’s children and no tag of its own', () => {
        expect(
            richTextToHtml({
                type: RICH_TEXT_NODE.Doc,
                content: [
                    {
                        type: 'callout',
                        content: [
                            {
                                type: RICH_TEXT_NODE.Paragraph,
                                content: [
                                    { type: RICH_TEXT_NODE.Text, text: 'Note' }
                                ]
                            }
                        ]
                    }
                ]
            })
        ).toBe('<p>Note</p>');
    });

    it('writes a decorative alt but never invents one', () => {
        expect(roundTrip('<img src="/a.png" alt="">')).toBe(
            '<img src="/a.png" alt="">'
        );
        expect(roundTrip('<img src="/a.png">')).toBe('<img src="/a.png">');
    });
});
