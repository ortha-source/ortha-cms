import { RICH_TEXT_ISSUE, inspectRichText } from './rich-text-structure';
import type { RichTextIssueCode } from './rich-text-structure';

/** The codes a value trips, in the order they are reported. */
const codes = (value: unknown): RichTextIssueCode[] =>
    inspectRichText(value).map((issue) => issue.code);

/** The blocking half — the only part that fails validation. */
const errors = (value: unknown): RichTextIssueCode[] =>
    inspectRichText(value)
        .filter((issue) => issue.severity === 'error')
        .map((issue) => issue.code);

describe('inspectRichText — headings', () => {
    it('passes an outline that descends one level at a time', () => {
        expect(codes('<h2>A</h2><h3>B</h3><h3>C</h3><h2>D</h2>')).toEqual([]);
    });

    it('flags a skipped level', () => {
        expect(codes('<h2>A</h2><h4>B</h4>')).toEqual([
            RICH_TEXT_ISSUE.HeadingLevelSkipped
        ]);
    });

    it('flags a heading above the body’s own top level', () => {
        expect(codes('<h3>A</h3><h1>B</h1>')).toEqual([
            RICH_TEXT_ISSUE.HeadingLevelInverted
        ]);
    });

    it('flags a heading with no text', () => {
        expect(codes('<h2></h2>')).toEqual([RICH_TEXT_ISSUE.HeadingEmpty]);
    });

    it('does not constrain the level the body starts at', () => {
        // A body sits inside a page whose own heading level it cannot see, so
        // starting at h2 (or h3) is normal, not a finding.
        expect(codes('<h3>Only</h3>')).toEqual([]);
    });
});

describe('inspectRichText — tables', () => {
    it('flags a table with no header cells', () => {
        expect(codes('<table><tr><td>a</td></tr></table>')).toEqual([
            RICH_TEXT_ISSUE.TableMissingHeader
        ]);
    });

    it('accepts a header row', () => {
        expect(
            codes('<table><tr><th>a</th></tr><tr><td>1</td></tr></table>')
        ).toEqual([]);
    });

    it('accepts a caption in place of header cells', () => {
        expect(
            codes('<table><caption>Sales</caption><tr><td>1</td></tr></table>')
        ).toEqual([]);
    });

    it('says nothing about a table with no cells at all', () => {
        expect(codes('<table></table>')).toEqual([]);
    });
});

describe('inspectRichText — links', () => {
    it('flags a link with no text', () => {
        expect(codes('<p><a href="/docs"></a></p>')).toEqual([
            RICH_TEXT_ISSUE.LinkTextEmpty
        ]);
    });

    it('warns on link text that describes the click, not the destination', () => {
        expect(codes('<p><a href="/docs">click here</a></p>')).toEqual([
            RICH_TEXT_ISSUE.LinkTextNotDescriptive
        ]);
        expect(
            inspectRichText('<p><a href="/d">Read more.</a></p>')[0]
        ).toEqual(expect.objectContaining({ severity: 'warning' }));
    });

    it('warns on a bare URL, which is announced character by character', () => {
        expect(
            codes('<p><a href="https://x.dev">https://x.dev</a></p>')
        ).toEqual([RICH_TEXT_ISSUE.LinkTextNotDescriptive]);
    });

    it('accepts text that names where it goes', () => {
        expect(codes('<p><a href="/docs">the API reference</a></p>')).toEqual(
            []
        );
    });

    it('reads a run split by a nested mark as one link', () => {
        expect(
            codes('<p><a href="/d">the <strong>API</strong> reference</a></p>')
        ).toEqual([]);
    });
});

describe('inspectRichText — language of parts', () => {
    it('accepts a well-formed tag on a passage', () => {
        expect(codes('<p>He said <span lang="fr">bonjour</span>.</p>')).toEqual(
            []
        );
    });

    it('flags a tag no user agent can parse', () => {
        expect(codes('<p lang="en_US">Hi</p>')).toEqual([
            RICH_TEXT_ISSUE.InvalidLanguageTag
        ]);
    });
});

describe('inspectRichText — the reported finding', () => {
    it('checks a document exactly as it checks the HTML it came from', () => {
        const asDocument = {
            type: 'doc',
            content: [
                {
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'A' }]
                },
                {
                    type: 'heading',
                    attrs: { level: 4 },
                    content: [{ type: 'text', text: 'B' }]
                }
            ]
        };
        expect(codes('<h2>A</h2><h4>B</h4>')).toEqual(codes(asDocument));
    });

    it('sees what the ORT-84 repro reported as clean', () => {
        // The finding, verbatim: a skipped heading level, an `<h1>` after an
        // `<h4>`, and a header-less table all validated clean.
        const body =
            '<h4>Intro</h4><h1>Title</h1><table><tr><td>a</td></tr></table>';
        expect(codes(body)).toEqual([
            RICH_TEXT_ISSUE.HeadingLevelInverted,
            RICH_TEXT_ISSUE.TableMissingHeader
        ]);
        // …and the table, which is wrong however the body is read, is the half
        // that blocks the save.
        expect(errors(body)).toEqual([RICH_TEXT_ISSUE.TableMissingHeader]);
    });

    it('carries the criterion each finding comes from', () => {
        expect(inspectRichText('<h2>A</h2><h4>B</h4>')[0]).toEqual({
            code: RICH_TEXT_ISSUE.HeadingLevelSkipped,
            message: 'has a heading that skips from h2 to h4',
            severity: 'error',
            wcag: '1.3.1'
        });
    });
});
