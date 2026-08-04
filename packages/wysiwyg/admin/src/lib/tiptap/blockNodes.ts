import { Node, mergeAttributes } from '@tiptap/core';
import {
    BLOCK_TYPE,
    CALLOUT_TONE,
    CALLOUT_TONES,
    MEDIA_SIZE,
    MEDIA_SIZES,
    mediaWidth
} from '@ortha-cms/wysiwyg-core';

/**
 * The block types TipTap has no equivalent for, in the exact HTML
 * `@ortha-cms/wysiwyg-core` parses.
 *
 * Each is a plain `Node.create` with a `parseHTML`/`renderHTML` pair, which is
 * the whole point of putting the schema in TipTap's hands: the editor's model
 * and the stored document are described once, in the same place, instead of a
 * renderer on one side and a serializer on the other agreeing by convention.
 */

/**
 * The `<figcaption>` of a figure, as the element the parser should read the
 * node's content from — or an empty stand-in when there is none.
 *
 * Pointing the parser at the caption is what stops it swallowing the `<img>`
 * (or the embed's link) as caption text. The stand-in matters just as much: a
 * bare selector returns nothing for an uncaptioned figure, and ProseMirror
 * dereferences it without checking.
 */
const captionOf = (element: HTMLElement): HTMLElement =>
    element.querySelector('figcaption') ??
    element.ownerDocument.createElement('figcaption');

/** A callout — an aside with a tone and an emoji. */
export const Callout = Node.create({
    name: BLOCK_TYPE.Callout,
    group: 'block',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            tone: {
                default: CALLOUT_TONE.Info,
                parseHTML: (element) => {
                    const tone = element.getAttribute('data-tone');
                    return tone && CALLOUT_TONES.includes(tone)
                        ? tone
                        : CALLOUT_TONE.Info;
                },
                renderHTML: (attributes) => ({
                    'data-tone': attributes['tone']
                })
            },
            emoji: {
                default: '💡',
                parseHTML: (element) => element.getAttribute('data-emoji'),
                renderHTML: (attributes) =>
                    attributes['emoji']
                        ? { 'data-emoji': attributes['emoji'] }
                        : {}
            }
        };
    },

    parseHTML() {
        return [{ tag: `aside[data-block="${BLOCK_TYPE.Callout}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'aside',
            mergeAttributes(HTMLAttributes, {
                'data-block': BLOCK_TYPE.Callout
            }),
            0
        ];
    }
});

/**
 * A toggle — `<details>` with its `<summary>`.
 *
 * Two content slots in one node, so the summary is its own node type rather
 * than an attribute: it holds inline text an author formats like any other
 * line, and an attribute could only ever hold a string.
 */
export const ToggleSummary = Node.create({
    name: 'toggleSummary',
    content: 'inline*',
    defining: true,
    selectable: false,
    parseHTML() {
        return [{ tag: 'summary' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['summary', mergeAttributes(HTMLAttributes), 0];
    }
});

/** A collapsible section. */
export const Toggle = Node.create({
    name: BLOCK_TYPE.Toggle,
    group: 'block',
    content: 'toggleSummary block*',
    defining: true,
    parseHTML() {
        return [{ tag: 'details' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['details', mergeAttributes(HTMLAttributes), 0];
    }
});

/** One column of a side-by-side layout. */
export const Column = Node.create({
    name: BLOCK_TYPE.Column,
    content: 'block+',
    isolating: true,
    parseHTML() {
        return [{ tag: `div[data-block="${BLOCK_TYPE.Column}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-block': BLOCK_TYPE.Column
            }),
            0
        ];
    }
});

/** A row of columns. */
export const Columns = Node.create({
    name: BLOCK_TYPE.Columns,
    group: 'block',
    content: `${BLOCK_TYPE.Column}+`,
    parseHTML() {
        return [{ tag: `div[data-block="${BLOCK_TYPE.Columns}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-block': BLOCK_TYPE.Columns
            }),
            0
        ];
    }
});

/**
 * An image, as a `<figure>` whose **content is the caption**.
 *
 * Not TipTap's `Image`, which is a bare void `<img>`. Making the caption the
 * node's content is what gives it a caret, the formatting toolbar and the
 * Enter/Backspace behaviour every other line already has — for free, rather
 * than as a second editable wired up by hand.
 *
 * The width rides on the figure, never on the `<img>`: it is a statement about
 * how much of the measure the picture takes, which is the figure's job, and a
 * width baked onto the image would fight whatever the delivery surface does
 * with its own container.
 */
export const ImageFigure = Node.create({
    name: BLOCK_TYPE.Image,
    group: 'block',
    content: 'inline*',
    draggable: true,
    isolating: true,

    addAttributes() {
        return {
            src: {
                default: '',
                parseHTML: (element) =>
                    element.querySelector('img')?.getAttribute('src') ?? ''
            },
            alt: {
                default: '',
                parseHTML: (element) =>
                    element.querySelector('img')?.getAttribute('alt') ?? ''
            },
            size: {
                default: MEDIA_SIZE.Full,
                parseHTML: (element) => {
                    const size = element.getAttribute('data-size');
                    return size && MEDIA_SIZES.includes(size as never)
                        ? size
                        : MEDIA_SIZE.Full;
                }
            },
            width: {
                default: null,
                parseHTML: (element) =>
                    mediaWidth(
                        Number.parseFloat(
                            (element as HTMLElement).style.width
                        ) || null
                    )
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure',
                // An embed is a `<figure>` too; only an `<img>` makes it this.
                getAttrs: (element) =>
                    (element as HTMLElement).querySelector('img')
                        ? null
                        : false,
                // The node's content is the **caption**, so the parser is
                // pointed at it: left to take the whole figure, it swallowed
                // the `<img>` as well and the picture came back inside its own
                // caption.
                contentElement: (element) => captionOf(element as HTMLElement)
            }
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const size = node.attrs['size'];
        const width = mediaWidth(node.attrs['width']);
        return [
            'figure',
            mergeAttributes(HTMLAttributes, {
                // A dragged width replaces the preset rather than joining it:
                // they say the same thing at different resolutions, and a
                // document carrying both leaves which one wins to luck.
                ...(width === null
                    ? size === MEDIA_SIZE.Full
                        ? {}
                        : { 'data-size': size }
                    : { style: `width: ${width}%` }),
                src: undefined,
                alt: undefined,
                size: undefined,
                width: undefined
            }),
            [
                'img',
                {
                    src: node.attrs['src'],
                    alt: node.attrs['alt'] ?? '',
                    loading: 'lazy'
                }
            ],
            ['figcaption', {}, 0]
        ];
    }
});

/**
 * An external embed. The URL rides in `data-url` and the visible content is a
 * plain link — this editor never emits an `<iframe>`. Whether to frame a third
 * party is the delivery surface's decision to make against its own CSP, and a
 * sanitizer that permits iframes is one `srcdoc` away from permitting anything.
 */
export const Embed = Node.create({
    name: BLOCK_TYPE.Embed,
    group: 'block',
    content: 'inline*',
    isolating: true,

    addAttributes() {
        return {
            url: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-url') ??
                    element.querySelector('a')?.getAttribute('href') ??
                    ''
            },
            provider: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-provider') ?? ''
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: `figure[data-block="${BLOCK_TYPE.Embed}"]`,
                // As for the image: the caption is the content, and the link
                // beside it is rendered from `data-url`, not parsed as text.
                contentElement: (element) => captionOf(element as HTMLElement)
            }
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const url = String(node.attrs['url'] ?? '');
        const provider = String(node.attrs['provider'] ?? '');
        return [
            'figure',
            mergeAttributes(HTMLAttributes, {
                'data-block': BLOCK_TYPE.Embed,
                'data-url': url,
                ...(provider ? { 'data-provider': provider } : {}),
                url: undefined,
                provider: undefined
            }),
            [
                'a',
                { href: url, target: '_blank', rel: 'noopener noreferrer' },
                url
            ],
            ['figcaption', {}, 0]
        ];
    }
});
