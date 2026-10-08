import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type { BulkPublishVerdict } from '@orthacms/content-admin';
import type { PublishAnnotation } from '../../slots/publishingSlots';
import { AttentionItem } from './AttentionItem';

const messages = defineMessages({
    title: {
        id: 'publishing.attention.title',
        defaultMessage: 'Needs attention'
    }
});

/** One entry the list names. */
export type AttentionEntry = {
    entryId: string;
    type: string;
    name: string;
    verdict?: BulkPublishVerdict;
    notes: PublishAnnotation[];
};

/**
 * Everything in the set that will not publish as things stand, **in one
 * place** — the fields a locale is missing and the approvals it is waiting
 * for. Rendered only when there is something in it, so a clean set is just
 * its list and a button.
 */
export function AttentionList({
    workspaceId,
    entries
}: {
    workspaceId: string;
    entries: readonly AttentionEntry[];
}) {
    const intl = useIntl();
    const headingId = useId();
    if (entries.length === 0) return null;
    return (
        <section
            aria-labelledby={headingId}
            className="rounded-lg border border-destructive/30 px-4 py-2"
        >
            <h2 id={headingId} className="pt-1 text-sm font-semibold">
                {intl.formatMessage(messages.title)}
            </h2>
            <ul className="divide-y">
                {entries.map((entry) => (
                    <AttentionItem
                        key={entry.entryId}
                        workspaceId={workspaceId}
                        {...entry}
                    />
                ))}
            </ul>
        </section>
    );
}
