import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Copy } from 'lucide-react';
import { Button } from '@ortha-cms/design-system';
import type { FilterGroup } from '../../../types/filter-tree.type';
import { treeToJsonNode } from '../../../utils/treeToJsonFilter';

const messages = defineMessages({
    title: { id: 'qb.preview.title', defaultMessage: 'JSON preview' },
    description: {
        id: 'qb.preview.description',
        defaultMessage:
            'Wire format sent to the server as the `filter` query param.'
    },
    empty: {
        id: 'qb.preview.empty',
        defaultMessage:
            'No conditions yet — add a rule to see the wire payload.'
    },
    copy: { id: 'qb.preview.copy', defaultMessage: 'Copy' },
    copied: { id: 'qb.preview.copied', defaultMessage: 'Copied' }
});

/** Props for {@link JsonPreview}. */
export type JsonPreviewProps = {
    /** Live draft tree from the QueryBuilder. */
    tree: FilterGroup | null;
};

/**
 * Always-visible read-out of the JSON payload the builder will send.
 * Updates live as the user edits so it doubles as a confidence signal
 * before Apply, and the Copy affordance makes it pasteable into curl,
 * a support ticket, or a DevTools breakpoint.
 */
export function JsonPreview({ tree }: JsonPreviewProps) {
    const intl = useIntl();
    // Pin `now` to the tree itself so `within_last` cutoffs don't drift
    // every render (e.g. as the user types in another rule). The user
    // sees a stable timestamp; Apply still resolves a fresh `now`.
    const now = useMemo(() => new Date(), [tree]);
    const node = treeToJsonNode(tree, now);
    const json = node ? JSON.stringify(node, null, 2) : null;

    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        if (!json) return;
        await navigator.clipboard.writeText(json);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {intl.formatMessage(messages.title)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.description)}
                    </p>
                </div>
                {json && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onCopy}
                        aria-label={intl.formatMessage(
                            copied ? messages.copied : messages.copy
                        )}
                    >
                        {copied ? (
                            <Check aria-hidden className="size-3.5" />
                        ) : (
                            <Copy aria-hidden className="size-3.5" />
                        )}
                        {intl.formatMessage(
                            copied ? messages.copied : messages.copy
                        )}
                    </Button>
                )}
            </div>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono leading-relaxed text-foreground">
                {json ?? (
                    <span className="text-muted-foreground italic">
                        {intl.formatMessage(messages.empty)}
                    </span>
                )}
            </pre>
        </div>
    );
}
