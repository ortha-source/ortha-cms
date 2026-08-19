/**
 * A rich-text document, serialized back to HTML.
 *
 * A structured body is the right thing to *store* and to *check*; HTML is
 * still what most consumers ultimately render, and what a `widget: 'textarea'`
 * field is authored as. Rather than leave every caller to write its own walk —
 * each with its own escaping and its own idea of which attributes survive —
 * the kernel serializes once, here.
 *
 * The output carries the semantics the rules check: heading levels, `<th>`
 * cells with their `scope`, a `<caption>`, `href`s, and every `lang` marker.
 * That last one is the point of the exercise — a language of parts that
 * doesn't survive serialization was never really expressible (504.2.1).
 *
 * Text and attribute values are escaped, and only the vocabulary below is
 * emitted, so the result is safe to render. Anything else in the document
 * contributes its children and nothing of itself: an unknown node cannot smuggle
 * a tag out through here.
 */

import { RICH_TEXT_MARK, RICH_TEXT_NODE } from './rich-text-node';
import type { RichTextMark, RichTextNode } from './rich-text-node';

/** The tag a known node type serializes to. */
const NODE_TAGS: Readonly<Record<string, string>> = {
    [RICH_TEXT_NODE.Paragraph]: 'p',
    [RICH_TEXT_NODE.BulletList]: 'ul',
    [RICH_TEXT_NODE.OrderedList]: 'ol',
    [RICH_TEXT_NODE.ListItem]: 'li',
    [RICH_TEXT_NODE.Blockquote]: 'blockquote',
    [RICH_TEXT_NODE.CodeBlock]: 'pre',
    [RICH_TEXT_NODE.Table]: 'table',
    [RICH_TEXT_NODE.TableRow]: 'tr',
    [RICH_TEXT_NODE.TableCell]: 'td',
    [RICH_TEXT_NODE.TableCaption]: 'caption',
    [RICH_TEXT_NODE.Container]: 'div'
};

/** The tag a known mark serializes to. */
const MARK_TAGS: Readonly<Record<string, string>> = {
    [RICH_TEXT_MARK.Bold]: 'strong',
    [RICH_TEXT_MARK.Italic]: 'em',
    [RICH_TEXT_MARK.Underline]: 'u',
    [RICH_TEXT_MARK.Strike]: 's',
    [RICH_TEXT_MARK.Code]: 'code',
    [RICH_TEXT_MARK.Highlight]: 'mark',
    [RICH_TEXT_MARK.Link]: 'a',
    [RICH_TEXT_MARK.Language]: 'span'
};

/** Text with the five characters that would otherwise end up as markup. */
function escapeText(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** An attribute value, safe inside double quotes. */
function escapeAttr(value: string): string {
    return escapeText(value).replace(/"/g, '&quot;');
}

/** `key="value"` pairs, skipping the blank ones. */
function attrString(attrs: Record<string, string | undefined>): string {
    return Object.entries(attrs)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => ` ${key}="${escapeAttr(value as string)}"`)
        .join('');
}

/**
 * `href`s that would execute rather than navigate. The editor's own link
 * extension blocks these on the way in; this blocks them on the way out, so a
 * document written straight through the API can't carry one either.
 */
function safeHref(href: string): string | undefined {
    return /^\s*(?:javascript|data|vbscript):/i.test(href) ? undefined : href;
}

/** The `lang` attribute of a node or mark, when it has one. */
function langAttrs(source: {
    attrs?: Record<string, unknown>;
}): Record<string, string | undefined> {
    const lang = source.attrs?.['lang'];
    return typeof lang === 'string' && lang.trim() !== ''
        ? { lang: lang.trim() }
        : {};
}

/** One text run, wrapped in its marks, innermost last. */
function serializeText(node: RichTextNode): string {
    let html = escapeText(node.text ?? '');
    for (const mark of [...(node.marks ?? [])].reverse()) {
        html = wrapMark(mark, html);
    }
    return html;
}

/** One mark around already-serialized inner HTML. */
function wrapMark(mark: RichTextMark, inner: string): string {
    const tag = MARK_TAGS[mark.type];
    if (!tag) return inner;
    if (mark.type === RICH_TEXT_MARK.Link) {
        const href = safeHref(String(mark.attrs?.['href'] ?? ''));
        // A link with no usable address is not a link — the text stays, the
        // anchor goes, rather than serializing a tab stop that goes nowhere.
        if (!href) return inner;
        return `<a${attrString({
            href,
            // Content authored here is published: an un-`rel`'d external link
            // is a referrer leak on somebody else's site.
            rel: 'noopener noreferrer nofollow',
            ...langAttrs(mark)
        })}>${inner}</a>`;
    }
    return `<${tag}${attrString(langAttrs(mark))}>${inner}</${tag}>`;
}

/** The children of a node, serialized in order. */
function serializeChildren(node: RichTextNode): string {
    return (node.content ?? []).map(richTextNodeToHtml).join('');
}

/** One node and everything under it. */
function richTextNodeToHtml(node: RichTextNode): string {
    switch (node.type) {
        case RICH_TEXT_NODE.Text:
            return serializeText(node);
        case RICH_TEXT_NODE.HardBreak:
            return '<br>';
        case RICH_TEXT_NODE.HorizontalRule:
            return '<hr>';
        case RICH_TEXT_NODE.Image: {
            const src = safeHref(String(node.attrs?.['src'] ?? ''));
            if (!src) return '';
            const alt = node.attrs?.['alt'];
            // `alt=""` is a claim ("this image is decorative"), so an empty
            // one is written out; an absent one stays absent rather than being
            // invented here, where nothing knows what the image shows.
            const altAttr =
                typeof alt === 'string' ? ` alt="${escapeAttr(alt)}"` : '';
            return `<img${attrString({ src, ...langAttrs(node) })}${altAttr}>`;
        }
        case RICH_TEXT_NODE.Heading: {
            const level = Number(node.attrs?.['level']);
            const tag = `h${Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1}`;
            return `<${tag}${attrString(langAttrs(node))}>${serializeChildren(node)}</${tag}>`;
        }
        case RICH_TEXT_NODE.TableHeader:
            // `scope="col"` is what associates the cells below a header with
            // it; without it a screen reader is left to infer the association
            // from proximity, which stops being right the moment a cell spans.
            return `<th${attrString({ scope: 'col', ...langAttrs(node) })}>${serializeChildren(node)}</th>`;
        case RICH_TEXT_NODE.Doc:
            return serializeChildren(node);
        default: {
            const tag = NODE_TAGS[node.type];
            // An unknown node contributes its children and no tag of its own.
            if (!tag) return serializeChildren(node);
            return `<${tag}${attrString(langAttrs(node))}>${serializeChildren(node)}</${tag}>`;
        }
    }
}

/** The HTML for a whole rich-text document. */
export function richTextToHtml(node: RichTextNode): string {
    return richTextNodeToHtml(node);
}
