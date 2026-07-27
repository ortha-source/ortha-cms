/**
 * Plain-text extraction — the answer to "what does this document actually
 * say", used for search indexing, table-cell previews, and the character
 * counts a `maxLength` rule is measured against. A user typing 200 characters
 * has written 200 characters, whatever the markup around them weighs.
 */

import { decodeBasicEntities } from '../html/escape';
import { isElement, type HtmlNode } from '../html/node';
import { parseHtmlNodes } from '../html/parse-nodes';

/** Elements after which a line break belongs in the extracted text. */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'blockquote',
    'pre',
    'figure',
    'figcaption',
    'aside',
    'details',
    'summary',
    'div',
    'section',
    'tr',
    'hr'
]);

/** Tags whose text is not content (dropped before extraction). */
const SILENT_TAGS: ReadonlySet<string> = new Set(['script', 'style']);

/** The concatenated text of a node tree, entities decoded, tags dropped. */
export function nodeText(nodes: readonly HtmlNode[]): string {
    let out = '';
    for (const node of nodes) {
        if (!isElement(node)) {
            out += decodeBasicEntities(node.text);
            continue;
        }
        if (SILENT_TAGS.has(node.tag)) continue;
        if (node.tag === 'br') {
            out += '\n';
            continue;
        }
        out += nodeText(node.children);
        if (BLOCK_TAGS.has(node.tag)) out += '\n';
    }
    return out;
}

/** The plain text of an HTML string, with runs of whitespace collapsed. */
export function htmlToPlainText(html: string): string {
    return nodeText(parseHtmlNodes(html))
        .replace(/[ \t\r\f\v]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * The user-visible character count of an HTML value — what a `minLength` /
 * `maxLength` rule on a wysiwyg field is measured against. Counting the markup
 * would make the limit depend on how the text was formatted, so bolding a word
 * would eat into the budget.
 */
export function htmlTextLength(html: string): number {
    return htmlToPlainText(html).length;
}

/**
 * A one-line excerpt of at most `maxLength` characters — the table-cell and
 * search-result rendering of a rich value. Truncation lands on a word boundary
 * when there is one nearby, and appends an ellipsis.
 */
export function htmlExcerpt(html: string, maxLength = 120): string {
    const text = htmlToPlainText(html).replace(/\s+/g, ' ');
    if (text.length <= maxLength) return text;
    const clipped = text.slice(0, maxLength);
    const lastSpace = clipped.lastIndexOf(' ');
    return `${(lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/** Whether an HTML value carries no actual content (only empty markup). */
export function isEmptyHtml(html: string | null | undefined): boolean {
    if (!html) return true;
    if (htmlToPlainText(html) !== '') return false;
    // Text isn't the only content: a divider, an image or an embed says
    // something without contributing a character.
    return !/<(img|hr|figure|iframe|video|audio)\b/i.test(html);
}
