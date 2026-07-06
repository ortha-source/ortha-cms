import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Copy } from 'lucide-react';
import { Badge } from '@ortha-cms/design-system';
import type { RecordStatus } from '../../../../types/recordDraft';
import { MetaRow } from './MetaRow';

const messages = defineMessages({
    title: { id: 'content.record.details.title', defaultMessage: 'Details' },
    entryId: {
        id: 'content.record.details.entryId',
        defaultMessage: 'Entry ID'
    },
    status: { id: 'content.record.details.status', defaultMessage: 'Status' },
    created: {
        id: 'content.record.details.created',
        defaultMessage: 'Created'
    },
    updated: {
        id: 'content.record.details.updated',
        defaultMessage: 'Last updated'
    },
    statusDraft: {
        id: 'content.record.details.statusDraft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.record.details.statusPublished',
        defaultMessage: 'Published'
    },
    copyAria: {
        id: 'content.record.details.copyAria',
        defaultMessage: 'Copy entry ID'
    }
});

/** How long the copied-check stays lit after a successful copy. */
const COPIED_MS = 1200;

/**
 * The **Details** widget: the entry's id (mono, click-to-copy), publish status
 * as a badge, and the created / last-updated timestamps. Timestamps re-render as
 * the editor stamps a new `updatedAt` on each save.
 */
export function DetailsWidget({
    id,
    status,
    createdAt,
    updatedAt
}: {
    id: string;
    status: RecordStatus;
    createdAt: string;
    updatedAt: string;
}) {
    const intl = useIntl();
    const [copied, setCopied] = useState(false);
    const published = status === 'published';

    const copy = () => {
        void navigator.clipboard?.writeText(id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_MS);
        });
    };

    const fmt = (iso: string) =>
        intl.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <section className="rounded-2xl border bg-background p-[18px]">
            <h2 className="text-[13px] font-medium text-muted-foreground">
                {intl.formatMessage(messages.title)}
            </h2>

            <dl className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <dt className="text-[13px] text-muted-foreground">
                        {intl.formatMessage(messages.entryId)}
                    </dt>
                    <dd>
                        <button
                            type="button"
                            onClick={copy}
                            aria-label={intl.formatMessage(messages.copyAria)}
                            className="group flex w-full items-center gap-1.5 rounded-md text-left font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <span className="min-w-0 flex-1 break-all">{id}</span>
                            {copied ? (
                                <Check className="size-3.5 shrink-0" aria-hidden />
                            ) : (
                                <Copy
                                    className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                    aria-hidden
                                />
                            )}
                        </button>
                    </dd>
                </div>

                <MetaRow label={intl.formatMessage(messages.status)}>
                    <Badge variant={published ? 'default' : 'secondary'}>
                        {intl.formatMessage(
                            published
                                ? messages.statusPublished
                                : messages.statusDraft
                        )}
                    </Badge>
                </MetaRow>
                <MetaRow label={intl.formatMessage(messages.created)}>
                    {fmt(createdAt)}
                </MetaRow>
                <MetaRow label={intl.formatMessage(messages.updated)}>
                    {fmt(updatedAt)}
                </MetaRow>
            </dl>
        </section>
    );
}
