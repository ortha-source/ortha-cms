/**
 * The **media nodes** — a resizable `<img>` and a resizable `<video>`.
 *
 * TipTap's stock Image extension is a bare `<img>` with no sizing, and it ships
 * nothing for video at all, so both are defined here. They are two node types
 * rather than one `media` node with a `kind` attribute because the HTML they
 * serialize to is genuinely different — an `<img alt>` and a `<video controls>`
 * — and a consumer parsing the stored body should meet ordinary tags, not a
 * `<div data-media-kind>` it has to interpret.
 *
 * What they *do* share is the attribute set and the node view (see
 * `presentation/components/MediaNodeView`), so resizing behaves identically.
 *
 * Sizing rides the **`width` attribute**, not an inline style: it survives
 * being pasted into an email, an RSS reader, or a CMS-rendered template, none
 * of which is guaranteed to keep a `style`. Height is deliberately never
 * written — the browser keeps the aspect ratio from the intrinsic size, and a
 * stored height is the thing that goes wrong when someone replaces the asset.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import {
    MEDIA_ALIGN,
    MEDIA_MIN_WIDTH,
    WYSIWYG_MEDIA_KIND,
    WYSIWYG_MEDIA_KINDS,
    asMediaAlign,
    type MediaAlign,
    type WysiwygMediaKind
} from '../../../domain/constants';
import { isSafeMediaSrc, safeMediaSrc } from '../../../domain/mediaSrc';
import { MediaNodeView } from './MediaNodeView';

/** One embed as the commands take it. Mirrors the slot's `WysiwygMediaEmbed`. */
export interface MediaEmbedInput {
    kind: WysiwygMediaKind;
    src: string;
    alt?: string;
    width?: number;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        wysiwygMedia: {
            /**
             * Place media at the caret, in order. Anything whose `src` fails the
             * safety check is skipped rather than stored — a source that hands
             * back a `javascript:` URL gets nothing inserted, not a broken node.
             */
            insertMedia: (embeds: readonly MediaEmbedInput[]) => ReturnType;
            /** Resize the selected media. `null` restores its natural width. */
            setMediaWidth: (width: number | null) => ReturnType;
            /**
             * Move the selected media across the measure. Separate from
             * `setTextAlign` because media is aligned by its **margins**, not by
             * the `text-align` that positions a block's inline children.
             */
            setMediaAlign: (align: MediaAlign) => ReturnType;
            /**
             * Describe the selected image. `decorative` marks it as carrying no
             * information — the alt is emptied and the "needs alt text" prompt
             * stops asking, because the author has answered.
             */
            setMediaAlt: (input: {
                alt: string;
                decorative: boolean;
            }) => ReturnType;
        };
    }
}

/** The attributes both nodes carry, minus `alt` (images only). */
function sizingAttributes() {
    return {
        src: {
            default: '',
            parseHTML: (element: HTMLElement) =>
                safeMediaSrc(element.getAttribute('src')),
            renderHTML: (attributes: Record<string, unknown>) => ({
                src: safeMediaSrc(attributes['src'])
            })
        },
        width: {
            default: null,
            parseHTML: (element: HTMLElement) => {
                const raw = Number(element.getAttribute('width'));
                // A stored width smaller than the floor (or garbage) reads as
                // "no explicit width" rather than being clamped up — the author
                // never chose the clamped number.
                return Number.isFinite(raw) && raw >= MEDIA_MIN_WIDTH
                    ? Math.round(raw)
                    : null;
            },
            renderHTML: (attributes: Record<string, unknown>) => {
                const width = attributes['width'];
                return typeof width === 'number' ? { width: String(width) } : {};
            }
        },
        /**
         * Where the block sits across the measure.
         *
         * A `data-` attribute rather than `align="center"` (long deprecated, and
         * dropped by anything that sanitizes presentational HTML) or an inline
         * `style` (a `style` is the first thing an email client or a template's
         * own sanitizer strips). It rides the published HTML as an inert hook
         * the renderer styles — the same one this plugin's stylesheet uses, so
         * the editor, the preview, and the published page agree.
         */
        align: {
            default: MEDIA_ALIGN.Left,
            parseHTML: (element: HTMLElement) =>
                asMediaAlign(element.getAttribute('data-align')),
            renderHTML: (attributes: Record<string, unknown>) => {
                const align = asMediaAlign(attributes['align']);
                // Left is where a block already sits; writing it would add an
                // attribute that changes nothing.
                return align === MEDIA_ALIGN.Left ? {} : { 'data-align': align };
            }
        }
    };
}

/** A resizable image. */
export const ResizableImage = Node.create({
    name: WYSIWYG_MEDIA_KIND.Image,

    group: 'block',

    // No content, and selected as a unit — clicking it selects the image
    // rather than putting a caret inside something that holds no text.
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            ...sizingAttributes(),
            alt: {
                default: '',
                parseHTML: (element) => element.getAttribute('alt') ?? '',
                renderHTML: (attributes) => ({ alt: attributes['alt'] ?? '' })
            },
            /**
             * The author said this image carries no information.
             *
             * `alt=""` is already HTML's way of saying that, but on its own it
             * cannot be told apart from "nobody has written the alt yet" — and
             * those need opposite treatment: one is finished, the other is an
             * accessibility defect the editor should keep pointing at. So the
             * decision is recorded as a `data-` attribute and the prompt keys
             * off it. It rides into the stored HTML, where it is inert for any
             * consumer that ignores it and a useful signal for one that doesn't.
             */
            decorative: {
                default: false,
                parseHTML: (element) => element.hasAttribute('data-decorative'),
                renderHTML: (attributes) =>
                    attributes['decorative'] ? { 'data-decorative': '' } : {}
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'img[src]',
                // Refuse the node outright rather than importing it with a
                // blanked `src`: an `<img>` with no source is a broken-image
                // icon in the body, which reads as data loss.
                getAttrs: (element) =>
                    isSafeMediaSrc(element.getAttribute('src')) && null
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['img', mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MediaNodeView);
    },

    addCommands() {
        return {
            insertMedia:
                (embeds) =>
                ({ commands, editor }) => {
                    const content = embeds
                        .filter((embed) => isSafeMediaSrc(embed.src))
                        .map((embed) => ({
                            type:
                                embed.kind === WYSIWYG_MEDIA_KIND.Video
                                    ? WYSIWYG_MEDIA_KIND.Video
                                    : WYSIWYG_MEDIA_KIND.Image,
                            attrs: {
                                src: embed.src,
                                alt: embed.alt ?? '',
                                width:
                                    typeof embed.width === 'number' &&
                                    embed.width >= MEDIA_MIN_WIDTH
                                        ? Math.round(embed.width)
                                        : null
                            }
                        }));
                    if (content.length === 0) return false;
                    // Guard the video type: an editor configured without it
                    // would throw on an unknown node name mid-insert.
                    const known = content.filter(
                        (node) => !!editor.schema.nodes[node.type]
                    );
                    if (known.length === 0) return false;
                    return commands.insertContent(known);
                },

            setMediaWidth:
                (width) =>
                ({ commands, editor }) => {
                    const next =
                        width === null
                            ? null
                            : Math.max(MEDIA_MIN_WIDTH, Math.round(width));
                    // Whichever media node the selection is on — the command is
                    // shared, so it must not assume the image.
                    for (const name of WYSIWYG_MEDIA_KINDS) {
                        if (editor.isActive(name)) {
                            return commands.updateAttributes(name, {
                                width: next
                            });
                        }
                    }
                    return false;
                },

            setMediaAlign:
                (align) =>
                ({ commands, editor }) => {
                    for (const name of WYSIWYG_MEDIA_KINDS) {
                        if (editor.isActive(name)) {
                            return commands.updateAttributes(name, { align });
                        }
                    }
                    return false;
                },

            setMediaAlt:
                ({ alt, decorative }) =>
                ({ commands }) =>
                    commands.updateAttributes(WYSIWYG_MEDIA_KIND.Image, {
                        // Decorative wins over whatever is in the box: the two
                        // can't both be true, and an `alt` left behind a ticked
                        // box would be announced by a screen reader anyway.
                        alt: decorative ? '' : alt,
                        decorative
                    })
        };
    }
});

/** A resizable video, played inline with the browser's own controls. */
export const ResizableVideo = Node.create({
    name: WYSIWYG_MEDIA_KIND.Video,

    group: 'block',

    atom: true,
    draggable: true,

    addAttributes() {
        return sizingAttributes();
    },

    parseHTML() {
        return [
            {
                tag: 'video[src]',
                getAttrs: (element) =>
                    isSafeMediaSrc(element.getAttribute('src')) && null
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        // `controls` is part of the content, not the chrome: a video published
        // without it can't be played wherever this body ends up.
        return ['video', mergeAttributes(HTMLAttributes, { controls: 'true' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MediaNodeView);
    }
});
