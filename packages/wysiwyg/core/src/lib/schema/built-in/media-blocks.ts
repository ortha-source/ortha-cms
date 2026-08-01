/**
 * The media block types — divider, image, embed.
 *
 * Image and embed both hold an optional **caption**, and the caption is the
 * block's `html`. That is not a trick: it is the one piece of text a reader
 * edits on these blocks, so making it the inline content gives it the caret,
 * the formatting toolbar and the Enter/Backspace behavior every other block
 * already has, for free.
 */

import { isElement, type HtmlElement, type HtmlNode } from '../../html/node';
import type { BlockDefinition } from '../block-definition';
import { BLOCK_GROUP, BLOCK_TYPE } from '../block-types';

/** A horizontal rule. The only block with nothing to edit at all. */
export const dividerBlock: BlockDefinition = {
    type: BLOCK_TYPE.Divider,
    content: 'void',
    tags: ['hr'],
    descriptor: {
        defaultLabel: 'Divider',
        keywords: ['hr', 'rule', 'separator', 'line'],
        group: BLOCK_GROUP.Basic,
        order: 7
    },
    toHtml: () => '<hr>'
};

/** An image with an optional caption. */
export const imageBlock: BlockDefinition = {
    type: BLOCK_TYPE.Image,
    content: 'inline',
    defaultAttrs: { src: '', alt: '' },
    tags: ['figure', 'img'],
    match: (element) =>
        element.tag === 'img' ||
        element.attrs['data-block'] !== BLOCK_TYPE.Embed,
    descriptor: {
        defaultLabel: 'Image',
        keywords: ['picture', 'photo', 'img', 'media'],
        group: BLOCK_GROUP.Media,
        order: 10
    },
    toHtml: (block, ctx) => {
        const src = ctx.text(block.attrs['src']);
        const alt = ctx.text(block.attrs['alt']);
        const caption = ctx.inline(block.html);
        // An image with no source is a block the author hasn't finished; it
        // renders as a picker in the editor and as nothing at all in the
        // output, rather than as a broken-image icon on the live site.
        if (!src) return '';
        const img = `<img src="${ctx.attr(src)}" alt="${ctx.attr(alt)}" loading="lazy">`;
        return `<figure>${img}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    },
    fromHtml: (element, ctx) => {
        const img = element.tag === 'img' ? element : findTag(element, 'img');
        if (!img) return null;
        const caption = findTag(element, 'figcaption');
        return ctx.block(BLOCK_TYPE.Image, {
            html: caption ? ctx.inline(caption.children) : '',
            attrs: {
                src: img.attrs['src'] ?? '',
                alt: img.attrs['alt'] ?? ''
            }
        });
    }
};

/**
 * An external embed (a video, a design file, a dashboard). The URL rides in
 * `data-url` and the visible content is a plain link — this package
 * deliberately never emits an `<iframe>`. Framing third-party HTML into a
 * delivery surface is the consumer's decision to make against its own CSP, and
 * a sanitizer that allows iframes is one `srcdoc` away from allowing anything.
 */
export const embedBlock: BlockDefinition = {
    type: BLOCK_TYPE.Embed,
    content: 'inline',
    defaultAttrs: { url: '', provider: '' },
    tags: ['figure'],
    match: (element) => element.attrs['data-block'] === BLOCK_TYPE.Embed,
    descriptor: {
        defaultLabel: 'Embed',
        keywords: ['video', 'youtube', 'iframe', 'link', 'external'],
        group: BLOCK_GROUP.Media,
        order: 11
    },
    toHtml: (block, ctx) => {
        const url = ctx.text(block.attrs['url']);
        if (!url) return '';
        const provider = ctx.text(block.attrs['provider']);
        const caption = ctx.inline(block.html);
        const providerAttr = provider
            ? ` data-provider="${ctx.attr(provider)}"`
            : '';
        return (
            `<figure data-block="${BLOCK_TYPE.Embed}" data-url="${ctx.attr(url)}"${providerAttr}>` +
            `<a href="${ctx.attr(url)}" target="_blank" rel="noopener noreferrer">${ctx.attr(url)}</a>` +
            (caption ? `<figcaption>${caption}</figcaption>` : '') +
            `</figure>`
        );
    },
    fromHtml: (element, ctx) => {
        const link = findTag(element, 'a');
        const url = element.attrs['data-url'] ?? link?.attrs['href'] ?? '';
        if (!url) return null;
        const caption = findTag(element, 'figcaption');
        return ctx.block(BLOCK_TYPE.Embed, {
            html: caption ? ctx.inline(caption.children) : '',
            attrs: { url, provider: element.attrs['data-provider'] ?? '' }
        });
    }
};

/** The first descendant element with `tag`, searched depth-first. */
function findTag(node: HtmlElement, tag: string): HtmlElement | null {
    for (const child of node.children as readonly HtmlNode[]) {
        if (!isElement(child)) continue;
        if (child.tag === tag) return child;
        const found = findTag(child, tag);
        if (found) return found;
    }
    return null;
}
