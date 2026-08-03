/**
 * The text block types — paragraph, heading, quote, callout. Each is one
 * {@link BlockDefinition}: its HTML output, the tags it parses back from, and
 * its slash-menu entry.
 */

import type { HtmlElement } from '../../html/node';
import type { BlockDefinition } from '../block-definition';
import {
    BLOCK_GROUP,
    BLOCK_TYPE,
    CALLOUT_TONE,
    CALLOUT_TONES
} from '../block-types';

/** Plain prose — the type every empty block and every Enter falls back to. */
export const paragraphBlock: BlockDefinition = {
    type: BLOCK_TYPE.Paragraph,
    content: 'inline',
    aligns: true,
    tags: ['p'],
    descriptor: {
        defaultLabel: 'Text',
        keywords: ['paragraph', 'plain', 'body'],
        group: BLOCK_GROUP.Basic,
        order: 0
    },
    toHtml: (block, ctx) =>
        `<p${ctx.align(block)}>${ctx.inline(block.html)}</p>`
};

/** A section heading, `level` 1–4. */
export const headingBlock: BlockDefinition = {
    type: BLOCK_TYPE.Heading,
    content: 'inline',
    aligns: true,
    defaultAttrs: { level: 2 },
    tags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    descriptor: {
        defaultLabel: 'Heading',
        keywords: ['title', 'h1', 'h2', 'h3', 'section'],
        group: BLOCK_GROUP.Basic,
        order: 1
    },
    toHtml: (block, ctx) => {
        const level = headingLevel(block.attrs['level']);
        return `<h${level}${ctx.align(block)}>${ctx.inline(
            block.html
        )}</h${level}>`;
    },
    fromHtml: (element, ctx) =>
        ctx.block(BLOCK_TYPE.Heading, {
            html: ctx.inline(element.children),
            attrs: { level: headingLevel(element.tag.slice(1)) }
        })
};

/** Clamps any incoming level to the 1–6 HTML has. */
function headingLevel(value: unknown): number {
    const level = Number(value);
    if (!Number.isFinite(level)) return 2;
    return Math.min(6, Math.max(1, Math.round(level)));
}

/** A pull quote. Holds its own line plus, optionally, nested blocks. */
export const quoteBlock: BlockDefinition = {
    type: BLOCK_TYPE.Quote,
    content: 'inline',
    aligns: true,
    tags: ['blockquote'],
    continueOnEnter: true,
    descriptor: {
        defaultLabel: 'Quote',
        keywords: ['blockquote', 'citation'],
        group: BLOCK_GROUP.Basic,
        order: 5
    },
    toHtml: (block, ctx) =>
        `<blockquote${ctx.align(block)}><p>${ctx.inline(block.html)}</p>${ctx.children(
            block.children
        )}</blockquote>`,
    fromHtml: (element, ctx) => {
        const split = splitLeadingParagraph(element);
        return ctx.block(BLOCK_TYPE.Quote, {
            html: ctx.inline(split.inline),
            children: ctx.children(split.rest)
        });
    }
};

/**
 * A highlighted aside with a tone and an emoji — the "callout" every
 * Notion-shaped editor has. Serialized as an `<aside>` carrying its settings in
 * `data-` attributes, so a delivery consumer can style it without parsing
 * classes.
 */
export const calloutBlock: BlockDefinition = {
    type: BLOCK_TYPE.Callout,
    content: 'inline',
    aligns: true,
    defaultAttrs: { tone: CALLOUT_TONE.Info, emoji: '💡' },
    tags: ['aside'],
    match: (element) => element.attrs['data-block'] === BLOCK_TYPE.Callout,
    descriptor: {
        defaultLabel: 'Callout',
        keywords: ['note', 'info', 'warning', 'tip', 'aside'],
        group: BLOCK_GROUP.Basic,
        order: 6
    },
    toHtml: (block, ctx) => {
        const tone = calloutTone(block.attrs['tone']);
        const emoji = ctx.text(block.attrs['emoji'], '');
        const emojiAttr = emoji ? ` data-emoji="${ctx.attr(emoji)}"` : '';
        return (
            `<aside data-block="${BLOCK_TYPE.Callout}" data-tone="${tone}"${emojiAttr}${ctx.align(
                block
            )}>` +
            `<p>${ctx.inline(block.html)}</p>${ctx.children(block.children)}` +
            `</aside>`
        );
    },
    fromHtml: (element, ctx) => {
        const split = splitLeadingParagraph(element);
        return ctx.block(BLOCK_TYPE.Callout, {
            html: ctx.inline(split.inline),
            attrs: {
                tone: calloutTone(element.attrs['data-tone']),
                emoji: element.attrs['data-emoji'] ?? ''
            },
            children: ctx.children(split.rest)
        });
    }
};

/** A known tone, or the neutral-ish default when the stored one is unknown. */
function calloutTone(value: unknown): string {
    return typeof value === 'string' && CALLOUT_TONES.includes(value)
        ? value
        : CALLOUT_TONE.Info;
}

/**
 * Splits a container element into "the leading paragraph's inline content" and
 * "everything after it". Quote and callout both serialize their own line as a
 * leading `<p>`, so both parse back the same way — and an element written by
 * hand *without* that wrapper still works, because its whole content is then
 * taken as the inline part.
 */
function splitLeadingParagraph(element: HtmlElement) {
    const [first, ...rest] = element.children;
    if (first && first.kind === 'element' && first.tag === 'p') {
        return { inline: first.children, rest };
    }
    const hasBlockChildren = element.children.some(
        (node) => node.kind === 'element' && BLOCK_LEVEL.has(node.tag)
    );
    return hasBlockChildren
        ? { inline: [], rest: element.children }
        : { inline: element.children, rest: [] };
}

/** Tags that mean "this container holds blocks, not a single line of text". */
const BLOCK_LEVEL: ReadonlySet<string> = new Set([
    'p',
    'ul',
    'ol',
    'blockquote',
    'pre',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'aside',
    'details',
    'hr',
    'div'
]);
