import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ImageIcon, LibraryBig } from 'lucide-react';
import { MEDIA_SIZE, MEDIA_SIZES } from '@ortha-cms/wysiwyg-core';
import { Button, Input, cn } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.image.label',
        defaultMessage: 'Image'
    },
    caption: {
        id: 'wysiwyg.block.image.caption',
        defaultMessage: 'Image caption'
    },
    captionPlaceholder: {
        id: 'wysiwyg.block.image.captionPlaceholder',
        defaultMessage: 'Write a caption…'
    },
    urlPlaceholder: {
        id: 'wysiwyg.block.image.urlPlaceholder',
        defaultMessage: 'Paste an image URL'
    },
    urlLabel: {
        id: 'wysiwyg.block.image.urlLabel',
        defaultMessage: 'Image URL'
    },
    add: {
        id: 'wysiwyg.block.image.add',
        defaultMessage: 'Add image'
    },
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
    sizeLabel: {
        id: 'wysiwyg.block.image.sizeLabel',
        defaultMessage: 'Width'
    },
    small: { id: 'wysiwyg.block.image.small', defaultMessage: 'Small' },
    medium: { id: 'wysiwyg.block.image.medium', defaultMessage: 'Medium' },
    large: { id: 'wysiwyg.block.image.large', defaultMessage: 'Large' },
    full: { id: 'wysiwyg.block.image.full', defaultMessage: 'Full' }
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
 * The alt field is shown inline rather than hidden behind a settings menu on
 * purpose: an image published with no alt text is an accessibility defect, and
 * the moment to fix it is while the author is looking at the picture.
 *
 * When the host supplied a media port, the block also offers its library. A
 * pasted URL keeps working either way — the editor's value is HTML, so an
 * image is a URL, and where that URL came from is nobody's business here.
 */
export function ImageBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly, media } = useEditor();
    const src = String(block.attrs['src'] ?? '');
    const alt = String(block.attrs['alt'] ?? '');
    const size = String(block.attrs['size'] ?? MEDIA_SIZE.Full);
    const [draftUrl, setDraftUrl] = useState('');

    /**
     * Asks the host for an asset and takes what it gives. One `setAttrs`, so
     * the source and its alt text land together — the alt is the asset's own,
     * and re-typing it on every use is how images end up without any.
     */
    const browse = async () => {
        const asset = await media?.pick().catch(() => null);
        if (!asset) return;
        commands.setAttrs(path, {
            src: asset.url,
            // Only overwrite the alt when the asset actually carries one; an
            // asset with none must not wipe out what the author already wrote.
            ...(asset.alt ? { alt: asset.alt } : {})
        });
    };

    if (!src) {
        // An unfinished image block — a picker, and nothing in the output.
        return (
            <div className="border-border bg-muted/30 my-1 flex items-center gap-2 rounded-md border border-dashed p-3">
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
                    onClick={() =>
                        commands.setAttrs(path, { src: draftUrl.trim() })
                    }
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
            </div>
        );
    }

    return (
        <figure
            className={cn(
                'my-2 space-y-2',
                SIZE_CLASS[size as keyof typeof SIZE_CLASS] ?? 'w-full',
                // The figure is what the alignment moves, so it needs a width
                // to be moved *within*; `BlockRow` sets the text alignment and
                // these margins do the rest.
                'data-[align=center]:mx-auto data-[align=right]:ml-auto'
            )}
            data-align={block.attrs['align'] ?? undefined}
        >
            <img
                src={src}
                alt={alt}
                loading="lazy"
                className="border-border max-h-[28rem] w-auto max-w-full rounded-md border object-contain"
            />
            {!readOnly && (
                // Deliberately still always visible — an image published with
                // no alt text is a defect, and hiding the field behind a menu
                // is how that happens. It is styled as editor chrome (muted,
                // compact, prefixed) so it doesn't read as part of the
                // document, and it warns while it is empty.
                <div className="flex items-center gap-2">
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
                            commands.setAttrs(path, { alt: event.target.value })
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
                <div className="flex items-center gap-1">
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
                            aria-pressed={size === preset}
                            className={cn(
                                'h-6 px-2 text-xs',
                                size === preset
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground'
                            )}
                            onClick={() =>
                                commands.setAttrs(path, { size: preset })
                            }
                        >
                            {intl.formatMessage(
                                messages[SIZE_MESSAGE[preset]]
                            )}
                        </Button>
                    ))}
                </div>
            )}
            <figcaption>
                <InlineEditable
                    caption
                    path={path}
                    html={block.html}
                    placeholder={intl.formatMessage(
                        messages.captionPlaceholder
                    )}
                    ariaLabel={intl.formatMessage(messages.caption)}
                    className="text-muted-foreground text-sm"
                />
            </figcaption>
        </figure>
    );
}
