import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ExternalLink, LinkIcon } from 'lucide-react';
import { Button, Input } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.embed.label',
        defaultMessage: 'Embed'
    },
    caption: {
        id: 'wysiwyg.block.embed.caption',
        defaultMessage: 'Embed caption'
    },
    captionPlaceholder: {
        id: 'wysiwyg.block.embed.captionPlaceholder',
        defaultMessage: 'Write a caption…'
    },
    urlLabel: {
        id: 'wysiwyg.block.embed.urlLabel',
        defaultMessage: 'Embed URL'
    },
    urlPlaceholder: {
        id: 'wysiwyg.block.embed.urlPlaceholder',
        defaultMessage: 'Paste a link to embed'
    },
    add: {
        id: 'wysiwyg.block.embed.add',
        defaultMessage: 'Embed'
    },
    open: {
        id: 'wysiwyg.block.embed.open',
        defaultMessage: 'Open in a new tab'
    },
    note: {
        id: 'wysiwyg.block.embed.note',
        defaultMessage:
            'Stored as a link. Your site decides how to render this provider.'
    }
});

/**
 * An external embed. The editor shows a link card, never a live `<iframe>`,
 * and stores the URL as data — framing third-party content is a decision for
 * the delivery surface and its content-security policy, not for the CMS.
 * The provider is derived from the host so a consumer can switch on it.
 */
export function EmbedBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const url = String(block.attrs['url'] ?? '');
    const [draftUrl, setDraftUrl] = useState('');

    if (!url) {
        return (
            <div className="border-border bg-muted/30 my-1 flex items-center gap-2 rounded-md border border-dashed p-3">
                <LinkIcon
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
                        commands.setAttrs(path, {
                            url: draftUrl.trim(),
                            provider: providerOf(draftUrl.trim())
                        })
                    }
                >
                    {intl.formatMessage(messages.add)}
                </Button>
            </div>
        );
    }

    return (
        <figure className="border-border my-2 space-y-2 rounded-md border p-3">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-2 text-sm break-all underline-offset-4 hover:underline"
            >
                <ExternalLink aria-hidden className="size-4 shrink-0" />
                <span>{url}</span>
                <span className="sr-only">
                    {intl.formatMessage(messages.open)}
                </span>
            </a>
            <p className="text-muted-foreground text-xs">
                {intl.formatMessage(messages.note)}
            </p>
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

/** The provider slug for a URL — its host without `www.` or the TLD. */
function providerOf(url: string): string {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        return host.split('.').slice(0, -1).join('.') || host;
    } catch {
        // Not a URL the platform can parse — store the link, skip the hint.
        return '';
    }
}
