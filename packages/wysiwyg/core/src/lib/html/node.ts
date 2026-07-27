/**
 * The tiny HTML node tree the parser and sanitizer both operate on.
 *
 * It is **not** a DOM: the package runs in Node (the server sanitizes stored
 * HTML before it is written) as well as in the browser, so it can't reach for
 * `DOMParser`. This is the whole shared vocabulary — an element with a lowercase
 * tag, plain attributes, children, or a text node.
 */

/** A parsed element. */
export interface HtmlElement {
    readonly kind: 'element';
    /** Lowercased tag name. */
    readonly tag: string;
    /** Lowercased attribute names → their (decoded-as-written) values. */
    readonly attrs: Readonly<Record<string, string>>;
    readonly children: readonly HtmlNode[];
}

/** A parsed run of text — still HTML-escaped, exactly as it appeared. */
export interface HtmlText {
    readonly kind: 'text';
    readonly text: string;
}

/** A node of the parsed tree. */
export type HtmlNode = HtmlElement | HtmlText;

/** Narrows a node to an element. */
export function isElement(node: HtmlNode): node is HtmlElement {
    return node.kind === 'element';
}

/** Narrows a node to text. */
export function isText(node: HtmlNode): node is HtmlText {
    return node.kind === 'text';
}

/** Elements that never have children or a closing tag. */
export const VOID_TAGS: ReadonlySet<string> = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
]);

/**
 * Elements whose content is raw text, not markup. They are tokenized as such so
 * a `<script>` body can never be mistaken for structure — and then dropped
 * wholesale by the sanitizer.
 */
export const RAW_TEXT_TAGS: ReadonlySet<string> = new Set([
    'script',
    'style',
    'textarea',
    'title'
]);

/**
 * Block-level elements that implicitly close an open `<p>`. Real-world HTML
 * (and anything pasted out of another editor) leaves paragraphs unclosed; the
 * tree builder needs to know which start tags end one.
 */
export const CLOSES_PARAGRAPH: ReadonlySet<string> = new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'details',
    'div',
    'dl',
    'fieldset',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'li',
    'main',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul'
]);
