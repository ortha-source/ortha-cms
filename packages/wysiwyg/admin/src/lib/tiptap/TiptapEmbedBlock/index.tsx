import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    NodeViewContent,
    NodeViewWrapper,
    type NodeViewProps
} from '@tiptap/react';
import { ExternalLink, Link2 } from 'lucide-react';
import { Button, Input } from '@ortha-cms/design-system';
import { useWysiwyg } from '../tiptapContext';

const messages = defineMessages({
    urlLabel: {
        id: 'wysiwyg.block.embed.urlLabel',
        defaultMessage: 'Embed URL'
    },
    urlPlaceholder: {
        id: 'wysiwyg.block.embed.urlPlaceholder',
        defaultMessage: 'Paste a link to embed'
    },
    add: { id: 'wysiwyg.block.embed.add', defaultMessage: 'Add embed' },
    caption: {
        id: 'wysiwyg.block.embed.caption',
        defaultMessage: 'Embed caption'
    }
});

/**
 * An external embed — a URL, a caption, and **no iframe**.
 *
 * Whether to frame a third party is the delivery surface's decision to make
 * against its own CSP, and a sanitizer that permits iframes is one `srcdoc`
 * away from permitting anything. What is stored is `data-url` and a plain link;
 * what a reader gets is whatever their surface chooses to do with that.
 *
 * The caption is the node's content, as it is for an image, so it behaves like
 * every other line rather than like a second editable wired up by hand.
 */
export function TiptapEmbedBlock({ node, updateAttributes }: NodeViewProps) {
    const intl = useIntl();
    const { readOnly } = useWysiwyg();
    const url = String(node.attrs['url'] ?? '');
    const [draft, setDraft] = useState('');

    if (!url) {
        return (
            <NodeViewWrapper
                as="div"
                contentEditable={false}
                className="border-border bg-muted/30 my-1 flex items-center gap-2 rounded-md border border-dashed p-3"
            >
                <Link2
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0"
                />
                <Input
                    value={draft}
                    disabled={readOnly}
                    aria-label={intl.formatMessage(messages.urlLabel)}
                    placeholder={intl.formatMessage(messages.urlPlaceholder)}
                    className="h-8 shadow-none"
                    onChange={(event) => setDraft(event.target.value)}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={readOnly || draft.trim() === ''}
                    onClick={() => updateAttributes({ url: draft.trim() })}
                >
                    {intl.formatMessage(messages.add)}
                </Button>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper
            as="figure"
            className="border-border my-2 space-y-1 rounded-md border p-3"
        >
            <div
                contentEditable={false}
                className="flex items-center gap-2 text-sm"
            >
                <ExternalLink
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0"
                />
                <span className="truncate">{url}</span>
                {!readOnly && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground ml-auto h-7 shrink-0 px-2 text-xs"
                        onClick={() => updateAttributes({ url: '' })}
                    >
                        {intl.formatMessage(messages.urlLabel)}
                    </Button>
                )}
            </div>
            <NodeViewContent<'figcaption'>
                as="figcaption"
                aria-label={intl.formatMessage(messages.caption)}
                className="text-muted-foreground text-sm"
            />
        </NodeViewWrapper>
    );
}
