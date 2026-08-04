/**
 * The one thing the whole rewrite rests on: **stored HTML survives the editor**.
 *
 * A document loaded into the TipTap schema and read straight back out must
 * serialize to the same string it came in as. If it does not, adopting TipTap
 * silently rewrites every record it opens — which no amount of UI polish would
 * make acceptable, and which a screenshot would never show.
 *
 * The comparison is made after `normalizeWysiwygHtml`, because that is the pass
 * the value actually leaves through (see `useWysiwygEditor`). What is being
 * tested is therefore the real contract: parse into the schema, render back,
 * canonicalize — and land on what you started with.
 */

import { generateHTML, generateJSON } from '@tiptap/html';
import { normalizeWysiwygHtml } from '@ortha-cms/wysiwyg-core';
import { buildExtensions } from './extensions';

const extensions = buildExtensions({});

/** Stored HTML → TipTap → stored HTML. */
function roundTrip(html: string): string {
    const json = generateJSON(html, extensions);
    return normalizeWysiwygHtml(generateHTML(json, extensions));
}

/** Every shape the stored format has, one per line. */
const DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
    ['a paragraph', '<p>Hello there</p>'],
    ['every heading', '<h1>One</h1><h2>Two</h2><h6>Six</h6>'],
    ['an aligned paragraph', '<p data-align="center">Centred</p>'],
    ['a bulleted list', '<ul><li>One</li><li>Two</li></ul>'],
    ['a numbered list', '<ol><li>One</li><li>Two</li></ol>'],
    [
        'a to-do list',
        '<ul data-list="todo"><li data-checked="false">Open</li>' +
            '<li data-checked="true">Done</li></ul>'
    ],
    ['a quote', '<blockquote><p>Said so</p></blockquote>'],
    ['a code block', '<pre><code>const a = 1;</code></pre>'],
    ['a divider', '<hr>'],
    ['the inline marks', '<p><strong>b</strong><em>i</em><u>u</u><s>s</s></p>'],
    ['inline code', '<p><code>code</code></p>'],
    [
        'a link',
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a></p>'
    ],
    ['a palette colour', '<p><span data-color="blue">blue</span></p>'],
    ['a custom colour', '<p><span style="color: #ff0055">brand</span></p>'],
    ['a highlight', '<p><mark data-highlight="yellow">lit</mark></p>'],
    ['a typeface', '<p><span data-font="serif">serif</span></p>'],
    ['a relative size', '<p><span data-text-size="large">big</span></p>'],
    [
        'a callout',
        '<aside data-block="callout" data-tone="info" data-emoji="💡"><p>Note</p></aside>'
    ],
    ['a toggle', '<details><summary>More</summary><p>Inside</p></details>'],
    [
        'columns',
        '<div data-block="columns"><div data-block="column"><p>L</p></div>' +
            '<div data-block="column"><p>R</p></div></div>'
    ],
    [
        'an image',
        '<figure><img src="/a.png" alt="A" loading="lazy"><figcaption>Cap</figcaption></figure>'
    ],
    [
        'a sized, aligned image',
        '<figure data-size="medium" data-align="center">' +
            '<img src="/a.png" alt="" loading="lazy"></figure>'
    ],
    [
        'an embed',
        '<figure data-block="embed" data-url="https://example.com">' +
            '<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a></figure>'
    ],
    [
        'a table with a header row',
        '<table><thead><tr><th>Name</th><th>Role</th></tr></thead>' +
            '<tbody><tr><td>Ada</td><td>Engineer</td></tr></tbody></table>'
    ],
    [
        'a table with widths and cell alignment',
        '<table style="width: 100%"><tbody><tr>' +
            '<td style="width: 30%" data-valign="middle" data-align="center">a</td>' +
            '<td>b</td></tr></tbody></table>'
    ]
];

describe('the TipTap schema round-trips stored HTML', () => {
    for (const [name, html] of DOCUMENTS) {
        it(name, () => {
            expect(roundTrip(html)).toBe(normalizeWysiwygHtml(html));
        });
    }
});
