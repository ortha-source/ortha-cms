import {
    asRichTextDocument,
    isEmptyRichText,
    richTextDocumentText,
    richTextPlainText
} from './rich-text-document';
import {
    RICH_TEXT_NODE,
    isRichTextDocument,
    isRichTextNode
} from './rich-text-node';
import type { RichTextDocument } from './rich-text-node';

/** A `doc` around the given blocks. */
const doc = (...content: unknown[]): RichTextDocument =>
    ({ type: RICH_TEXT_NODE.Doc, content }) as RichTextDocument;

/** A paragraph of plain text. */
const p = (text: string) => ({
    type: RICH_TEXT_NODE.Paragraph,
    content: [{ type: RICH_TEXT_NODE.Text, text }]
});

describe('isRichTextDocument', () => {
    it('accepts a well-formed tree', () => {
        expect(isRichTextDocument(doc(p('Hello')))).toBe(true);
    });

    it('accepts an empty document', () => {
        expect(isRichTextDocument({ type: 'doc' })).toBe(true);
    });

    it('rejects anything that is not rooted at doc', () => {
        expect(isRichTextDocument(p('Hello'))).toBe(false);
        expect(isRichTextDocument('<p>Hello</p>')).toBe(false);
        expect(isRichTextDocument(null)).toBe(false);
        expect(isRichTextDocument([])).toBe(false);
    });

    it('rejects a tree whose children are not nodes', () => {
        expect(isRichTextDocument({ type: 'doc', content: ['Hello'] })).toBe(
            false
        );
        expect(
            isRichTextDocument({ type: 'doc', content: [{ text: 'no type' }] })
        ).toBe(false);
    });

    it('rejects a node whose marks are not marks', () => {
        expect(isRichTextNode({ type: 'text', text: 'x', marks: [1] })).toBe(
            false
        );
    });
});

describe('richTextDocumentText', () => {
    it('reads the words and none of the structure', () => {
        expect(
            richTextDocumentText(
                doc({
                    type: RICH_TEXT_NODE.Paragraph,
                    content: [
                        { type: RICH_TEXT_NODE.Text, text: 'Hello ' },
                        {
                            type: RICH_TEXT_NODE.Text,
                            text: 'world',
                            marks: [{ type: 'bold' }]
                        }
                    ]
                })
            )
        ).toBe('Hello world');
    });

    it('breaks the line between blocks', () => {
        expect(richTextDocumentText(doc(p('One'), p('Two')))).toBe('One\nTwo');
    });

    it('breaks the line on a hard break', () => {
        expect(
            richTextDocumentText(
                doc({
                    type: RICH_TEXT_NODE.Paragraph,
                    content: [
                        { type: RICH_TEXT_NODE.Text, text: 'One' },
                        { type: RICH_TEXT_NODE.HardBreak },
                        { type: RICH_TEXT_NODE.Text, text: 'Two' }
                    ]
                })
            )
        ).toBe('One\nTwo');
    });
});

describe('richTextPlainText', () => {
    it('reads a document', () => {
        expect(richTextPlainText(doc(p('Hello')))).toBe('Hello');
    });

    it('reads a legacy HTML string', () => {
        expect(richTextPlainText('<p>Hello <em>there</em></p>')).toBe(
            'Hello there'
        );
    });

    it('reads nothing out of anything else', () => {
        expect(richTextPlainText(42)).toBe('');
        expect(richTextPlainText(null)).toBe('');
    });
});

describe('isEmptyRichText', () => {
    it('treats the document an emptied editor leaves behind as empty [wysiwyg:I-12]', () => {
        expect(isEmptyRichText(doc({ type: RICH_TEXT_NODE.Paragraph }))).toBe(
            true
        );
        expect(isEmptyRichText(doc(p('   ')))).toBe(true);
        expect(isEmptyRichText(doc())).toBe(true);
    });

    it('treats the markup an emptied editor leaves behind as empty', () => {
        expect(isEmptyRichText('')).toBe(true);
        expect(isEmptyRichText('<p></p>')).toBe(true);
        expect(isEmptyRichText('<p><br></p>')).toBe(true);
        expect(isEmptyRichText(null)).toBe(true);
    });

    it('treats a node that means something without words as content [wysiwyg:I-12]', () => {
        // The lost-edit case: a table or a divider an author has inserted but
        // not yet typed into is content, and collapsing it to empty throws it
        // away on save.
        expect(isEmptyRichText(doc({ type: RICH_TEXT_NODE.Table }))).toBe(
            false
        );
        expect(
            isEmptyRichText(doc({ type: RICH_TEXT_NODE.HorizontalRule }))
        ).toBe(false);
        expect(isEmptyRichText(doc({ type: 'callout' }))).toBe(false);
    });

    it('treats words as content', () => {
        expect(isEmptyRichText(doc(p('Hi')))).toBe(false);
        expect(isEmptyRichText('<p>Hi</p>')).toBe(false);
    });
});

describe('asRichTextDocument', () => {
    it('returns a document untouched', () => {
        const value = doc(p('Hello'));
        expect(asRichTextDocument(value)).toBe(value);
    });

    it('reads a legacy HTML string as a document', () => {
        expect(asRichTextDocument('<h2>Hi</h2>').content?.[0].type).toBe(
            RICH_TEXT_NODE.Heading
        );
    });

    it('reads anything else as an empty document', () => {
        expect(asRichTextDocument(42)).toEqual({
            type: RICH_TEXT_NODE.Doc,
            content: []
        });
    });
});
