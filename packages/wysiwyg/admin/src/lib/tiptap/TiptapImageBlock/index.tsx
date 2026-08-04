import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    NodeViewContent,
    NodeViewWrapper,
    type NodeViewProps
} from '@tiptap/react';
import { ImageIcon, LibraryBig } from 'lucide-react';
import {
    BLOCK_ALIGN,
    MEDIA_SIZE,
    MEDIA_SIZES,
    mediaWidth
} from '@ortha-cms/wysiwyg-core';
import { Button, Input, cn } from '@ortha-cms/design-system';
import { useWysiwyg } from '../tiptapContext';
import { ImageGrip } from './ImageGrip';

const messages = defineMessages({
    caption: {
        id: 'wysiwyg.block.image.caption',
        defaultMessage: 'Image caption'
    },
    urlPlaceholder: {
        id: 'wysiwyg.block.image.urlPlaceholder',
        defaultMessage: 'Paste an image URL'
    },
    urlLabel: {
        id: 'wysiwyg.block.image.urlLabel',
        defaultMessage: 'Image URL'
    },
    add: { id: 'wysiwyg.block.image.add', defaultMessage: 'Add image' },
    altLabel: {
        id: 'wysiwyg.block.image.altLabel',
        defaultMessage: 'Alt text'
    },
    altPlaceholder: {
        id: 'wysiwyg.block.image.altPlaceholder',
        defaultMessage: 'Describe the image for screen readers'
    },
    browse: {
        id: 'wysiwyg.block.image.browse',
        defaultMessage: 'Choose from library'
    },
    replace: {
        id: 'wysiwyg.block.image.replace',
        defaultMessage: 'Replace from library'
    },
    sizeLabel: { id: 'wysiwyg.block.image.sizeLabel', defaultMessage: 'Width' },
    small: { id: 'wysiwyg.block.image.small', defaultMessage: 'Small' },
    medium: { id: 'wysiwyg.block.image.medium', defaultMessage: 'Medium' },
    large: { id: 'wysiwyg.block.image.large', defaultMessage: 'Large' },
    full: { id: 'wysiwyg.block.image.full', defaultMessage: 'Full' },
    customWidth: {
        id: 'wysiwyg.block.image.customWidth',
        defaultMessage: '{percent}%'
    }
});

/** The label each width preset reads as. */
const SIZE_MESSAGE = {
    [MEDIA_SIZE.Small]: 'small',
    [MEDIA_SIZE.Medium]: 'medium',
    [MEDIA_SIZE.Large]: 'large',
    [MEDIA_SIZE.Full]: 'full'
} as const;

/** How wide the editor draws each preset — the mirror of `WYSIWYG_PROSE`. */
const SIZE_CLASS = {
    [MEDIA_SIZE.Small]: 'w-1/3',
    [MEDIA_SIZE.Medium]: 'w-1/2',
    [MEDIA_SIZE.Large]: 'w-3/4',
    [MEDIA_SIZE.Full]: 'w-full'
} as const;

/**
 * An image with a caption and alt text.
 *
 * The **caption is the node's content**, so it is a `NodeViewContent` rather
 * than a second editable wired up by hand: the caret, the formatting toolbar
 * and the Enter/Backspace behaviour every other line has come with it. The rest
 * of the block — the picker, the alt field, the size presets, the grips — is
 * chrome, and is `contentEditable={false}` so typing in it is never typing in
 * the document.
 *
 * The alt field is shown inline rather than hidden behind a settings menu on
 * purpose: an image published with no alt text is an accessibility defect, and
 * the moment to fix it is while the author is looking at the picture.
 *
 * When the host supplied a media port, the block also offers its library. A
 * pasted URL keeps working either way — the editor's value is HTML, so an image
 * is a URL, and where that URL came from is nobody's business here.
 */
export function TiptapImageBlock({ node, updateAttributes }: NodeViewProps) {
    const intl = useIntl();
    const { readOnly, media } = useWysiwyg();
    const src = String(node.attrs['src'] ?? '');
    const alt = String(node.attrs['alt'] ?? '');
    const size = String(node.attrs['size'] ?? MEDIA_SIZE.Full);
    // A dragged width overrides the preset — they say the same thing at
    // different resolutions, and the one the author touched last wins.
    const width = mediaWidth(node.attrs['width']);
    const align = node.attrs['align'];
    // `text-align` can't move the picture: the CSS reset makes `<img>` a block,
    // and a block box ignores it. Auto margins are what actually centre it.
    const imageAlign =
        align === BLOCK_ALIGN.Center
            ? 'mx-auto'
            : align === BLOCK_ALIGN.Right
              ? 'ml-auto'
              : '';
    const [draftUrl, setDraftUrl] = useState('');

    /**
     * Asks the host for an asset and takes what it gives. One update, so the
     * source and its alt text land together — the alt is the asset's own, and
     * re-typing it on every use is how images end up without any.
     */
    const browse = async () => {
        const asset = await media?.pick().catch(() => null);
        if (!asset) return;
        updateAttributes({
            src: asset.url,
            // Only overwrite the alt when the asset actually carries one; an
            // asset with none must not wipe out what the author already wrote.
            ...(asset.alt ? { alt: asset.alt } : {})
        });
    };

    if (!src) {
        // An unfinished image block — a picker, and nothing in the output.
        return (
            <NodeViewWrapper
                as="div"
                contentEditable={false}
                className="border-border bg-muted/30 my-1 flex items-center gap-2 rounded-md border border-dashed p-3"
            >
                <ImageIcon
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0"
                />
                <Input
                    value={draftUrl}
                    disabled={readOnly}
                    aria-label={intl.formatMessage(messages.urlLabel)}
                    placeholder={intl.formatMessage(messages.urlPlaceholder)}
                    className="h-8 shadow-none"
                    onChange={(event) => setDraftUrl(event.target.value)}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={readOnly || draftUrl.trim() === ''}
                    onClick={() => updateAttributes({ src: draftUrl.trim() })}
                >
                    {intl.formatMessage(messages.add)}
                </Button>
                {media && !readOnly && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={browse}
                    >
                        <LibraryBig aria-hidden className="size-4" />
                        {intl.formatMessage(messages.browse)}
                    </Button>
                )}
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper
            as="figure"
            data-align={align ?? undefined}
            className={cn(
                'group/image my-2 space-y-2',
                width === null
                    ? (SIZE_CLASS[size as keyof typeof SIZE_CLASS] ?? 'w-full')
                    : undefined,
                // The figure moves too, for the sizes that give it a width
                // narrower than the column.
                imageAlign
            )}
            style={width === null ? undefined : { width: `${width}%` }}
        >
            {/* `w-fit` so the grips hug the **picture** rather than the figure:
                an image narrower than its column would otherwise leave the
                right-hand grip floating in empty space beside it. */}
            <div
                contentEditable={false}
                className={cn('relative w-fit max-w-full', imageAlign)}
            >
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    className="border-border max-h-[28rem] w-auto max-w-full rounded-md border object-contain"
                />
                {!readOnly && (
                    <>
                        <ImageGrip
                            side="left"
                            width={width}
                            onResize={(percent) =>
                                updateAttributes({ width: percent })
                            }
                        />
                        <ImageGrip
                            side="right"
                            width={width}
                            onResize={(percent) =>
                                updateAttributes({ width: percent })
                            }
                        />
                    </>
                )}
            </div>

            {!readOnly && (
                // Deliberately always visible — an image published with no alt
                // text is a defect, and hiding the field behind a menu is how
                // that happens. Styled as editor chrome so it doesn't read as
                // part of the document, and it warns while it is empty.
                <div
                    contentEditable={false}
                    className="flex items-center gap-2"
                >
                    <span
                        aria-hidden
                        className="text-muted-foreground shrink-0 text-[11px] font-medium tracking-wide uppercase"
                    >
                        {intl.formatMessage(messages.altLabel)}
                    </span>
                    <Input
                        value={alt}
                        aria-label={intl.formatMessage(messages.altLabel)}
                        placeholder={intl.formatMessage(
                            messages.altPlaceholder
                        )}
                        className={cn(
                            'h-7 border-dashed bg-transparent text-xs shadow-none',
                            alt.trim() === '' && 'border-warning/60'
                        )}
                        onChange={(event) =>
                            updateAttributes({ alt: event.target.value })
                        }
                    />
                    {media && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground h-7 shrink-0 px-2 text-xs"
                            onClick={browse}
                        >
                            <LibraryBig aria-hidden className="size-3.5" />
                            {intl.formatMessage(messages.replace)}
                        </Button>
                    )}
                </div>
            )}

            {!readOnly && (
                <div
                    contentEditable={false}
                    className="flex items-center gap-1"
                >
                    <span
                        aria-hidden
                        className="text-muted-foreground shrink-0 text-[11px] font-medium tracking-wide uppercase"
                    >
                        {intl.formatMessage(messages.sizeLabel)}
                    </span>
                    {MEDIA_SIZES.map((preset) => (
                        <Button
                            key={preset}
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-pressed={width === null && size === preset}
                            className={cn(
                                'h-6 px-2 text-xs',
                                width === null && size === preset
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground'
                            )}
                            // Picking a preset drops a dragged width: the two
                            // are one choice, and leaving both would store a
                            // document that says `medium` and `72%` at once.
                            onClick={() =>
                                updateAttributes({ size: preset, width: null })
                            }
                        >
                            {intl.formatMessage(messages[SIZE_MESSAGE[preset]])}
                        </Button>
                    ))}
                    {width !== null && (
                        <span className="bg-accent text-accent-foreground rounded px-2 py-0.5 text-xs">
                            {intl.formatMessage(messages.customWidth, {
                                percent: width
                            })}
                        </span>
                    )}
                </div>
            )}

            {/* Explicitly generic: `as` is `NoInfer`, so the element type has
                to be stated rather than read off the prop. */}
            <NodeViewContent<'figcaption'>
                as="figcaption"
                aria-label={intl.formatMessage(messages.caption)}
                className="text-muted-foreground text-sm"
            />
        </NodeViewWrapper>
    );
}
