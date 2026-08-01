/**
 * Whole-block inline marks — applying a mark to a **block**, rather than to a
 * range inside one.
 *
 * The browser's own `execCommand` handles a range inside a single editable, and
 * that is what the caret-level toolbar uses. It cannot help when several blocks
 * are selected at once: each is its own editable, so there is no range spanning
 * them. Bolding five paragraphs is therefore a *string* operation on each
 * block's inline HTML, and it lives here so both runtimes get the same answer.
 */

import { isElement, type HtmlNode } from './node';
import { parseHtmlNodes } from './parse-nodes';
import { serializeNodes } from './sanitize';

/** Tags that can wrap a whole block's content as a mark. */
export const INLINE_MARK_TAG = {
    Bold: 'strong',
    Italic: 'em',
    Underline: 'u',
    Strike: 's',
    Code: 'code'
} as const;

/** A tag that can wrap a whole block's content as a mark. */
export type InlineMarkTag =
    (typeof INLINE_MARK_TAG)[keyof typeof INLINE_MARK_TAG];

/** Nodes with insignificant whitespace-only text runs dropped. */
function meaningful(nodes: readonly HtmlNode[]): HtmlNode[] {
    return nodes.filter((node) => isElement(node) || node.text.trim() !== '');
}

/**
 * Whether the block's whole content already carries `tag` — i.e. it is a single
 * element of that tag. Anything less (a bolded half, two runs where one is
 * bold) counts as **not** marked, so toggling marks the lot; that is the rule
 * every word processor uses and the only one that converges.
 */
export function isBlockMarked(html: string, tag: InlineMarkTag): boolean {
    const nodes = meaningful(parseHtmlNodes(html ?? ''));
    return nodes.length === 1 && isElement(nodes[0]) && nodes[0].tag === tag;
}

/**
 * Wraps a block's content in `tag`, or unwraps it when the whole block is
 * already wrapped. Empty content is left alone — a mark around nothing is
 * markup nobody asked for, and it would make the block read as non-empty to
 * `isEmptyHtml`.
 */
export function toggleBlockMark(html: string, tag: InlineMarkTag): string {
    const content = html ?? '';
    if (content.trim() === '') return content;
    if (!isBlockMarked(content, tag)) return `<${tag}>${content}</${tag}>`;

    const nodes = meaningful(parseHtmlNodes(content));
    const only = nodes[0];
    return isElement(only) ? serializeNodes(only.children) : content;
}
