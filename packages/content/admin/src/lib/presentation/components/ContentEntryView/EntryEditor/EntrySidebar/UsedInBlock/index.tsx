import { defineMessages, useIntl } from 'react-intl';
import { TriangleAlert } from 'lucide-react';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import type { EntryRecord } from '../../../../../../domain/types/contentType';
import { useEntryUsages } from '../../../../../../application/useEntryUsages';
import { EntrySidebarRow } from '../../../../EntrySidebarRow';
import { EntrySidebarSection } from '../../../../EntrySidebarSection';

const messages = defineMessages({
    title: {
        id: 'content.sidebar.usedIn.title',
        defaultMessage: 'Used in'
    },
    links: {
        id: 'content.sidebar.usedIn.links',
        defaultMessage: '{count, plural, one {# link} other {# links}}'
    },
    publishNote: {
        id: 'content.sidebar.usedIn.publishNote',
        defaultMessage:
            'Publishing updates {count, plural, one {# workspace} other {# workspaces}}'
    }
});

/**
 * The **Used in** section of the entry rail: which other workspaces link to
 * this record, and how many links each holds — read from
 * `GET /content/:type/:id/usages`. Only a **shared** workspace's records can be
 * linked from elsewhere, so the read is made only when the open workspace is
 * shared.
 *
 * The note under the list is the reason the block exists: a published record
 * of a shared workspace is what those workspaces show, so publishing a change
 * here changes it there too.
 *
 * It renders **nothing** while loading, when nothing links here, and when the
 * read fails. This is a courtesy beside the editor, not a thing the author
 * asked for, and an error in the rail about a feature they may never have
 * noticed would be noise — the record itself is unaffected either way. Hiding
 * leaves no stray divider, since the divider is the rail's, not the section's.
 */
export function UsedInBlock({
    entry,
    typeName
}: {
    /** The saved record open in the editor. */
    entry: EntryRecord;
    /** Its content type. */
    typeName: string;
}) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const usages = useEntryUsages(typeName, entry.id, workspace.isShared);

    if (!workspace.isShared || !usages.isSuccess) return null;
    const items = usages.data;
    if (items.length === 0) return null;

    return (
        <EntrySidebarSection title={intl.formatMessage(messages.title)}>
            <div className="flex flex-col gap-3">
                <dl className="flex flex-col gap-3">
                    {items.map((usage) => (
                        <EntrySidebarRow
                            key={usage.workspaceId}
                            label={usage.workspaceName}
                        >
                            {intl.formatMessage(messages.links, {
                                count: usage.count
                            })}
                        </EntrySidebarRow>
                    ))}
                </dl>
                <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft p-2.5 text-xs text-warning-soft-foreground">
                    <TriangleAlert
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden
                    />
                    {intl.formatMessage(messages.publishNote, {
                        count: items.length
                    })}
                </p>
            </div>
        </EntrySidebarSection>
    );
}
