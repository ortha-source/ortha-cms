import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ImageIcon } from 'lucide-react';
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
    }
});

/**
 * An image with a caption and alt text.
 *
 * The alt field is shown inline rather than hidden behind a settings menu on
 * purpose: an image published with no alt text is an accessibility defect, and
 * the moment to fix it is while the author is looking at the picture.
 */
export function ImageBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const src = String(block.attrs['src'] ?? '');
    const alt = String(block.attrs['alt'] ?? '');
    const [draftUrl, setDraftUrl] = useState('');

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
            </div>
        );
    }

    return (
        <figure className="my-2 space-y-2">
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
                </div>
            )}
            <figcaption>
                <InlineEditable
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
