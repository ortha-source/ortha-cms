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
import { toPercentWidth, widthFromStyle } from '../../html/sanitize';
import type { BlockDefinition } from '../block-definition';
import {
    BLOCK_GROUP,
    BLOCK_TYPE,
    MEDIA_SIZE,
    MEDIA_SIZES
} from '../block-types';

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
    aligns: true,
    defaultAttrs: { src: '', alt: '', size: MEDIA_SIZE.Full },
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
        // The size rides on the figure, not the `<img>`: it is a statement
        // about how much of the measure the picture takes, which is the
        // figure's job — and a width baked onto the image would fight whatever
        // the delivery surface does with its own container.
        //
        // A dragged width **replaces** the preset rather than joining it: they
        // say the same thing at different resolutions, and emitting both leaves
        // a document where `data-size="medium"` and `width: 72%` disagree and
        // whichever the consumer honours is luck.
        const width = mediaWidth(block.attrs['width']);
        const size = mediaSize(block.attrs['size']);
        const sizeAttr =
            width !== null || size === MEDIA_SIZE.Full
                ? ''
                : ` data-size="${ctx.attr(size)}"`;
        // The canonical spacing the sanitizer would rewrite it to, so a value
        // this serializer wrote survives a round trip byte-identically.
        const widthAttr = width === null ? '' : ` style="width: ${width}%"`;
        return `<figure${widthAttr}${sizeAttr}${ctx.align(block)}>${img}${
            caption ? `<figcaption>${caption}</figcaption>` : ''
        }</figure>`;
    },
    fromHtml: (element, ctx) => {
        const img = element.tag === 'img' ? element : findTag(element, 'img');
        if (!img) return null;
        const caption = findTag(element, 'figcaption');
        const width = widthFromStyle(element.attrs['style']);
        return ctx.block(BLOCK_TYPE.Image, {
            html: caption ? ctx.inline(caption.children) : '',
            attrs: {
                src: img.attrs['src'] ?? '',
                alt: img.attrs['alt'] ?? '',
                size: mediaSize(element.attrs['data-size']),
                ...(width === null ? {} : { width })
            }
        });
    }
};

/** A stored custom width as a number of percent, or `null` when there is none. */
export function mediaWidth(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const percent = toPercentWidth(`${value}%`);
    return percent === null ? null : Number.parseFloat(percent);
}

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

/** A known size preset, or full width when the stored one is unknown. */
function mediaSize(value: unknown): string {
    return typeof value === 'string' && MEDIA_SIZES.includes(value as never)
        ? value
        : MEDIA_SIZE.Full;
}
