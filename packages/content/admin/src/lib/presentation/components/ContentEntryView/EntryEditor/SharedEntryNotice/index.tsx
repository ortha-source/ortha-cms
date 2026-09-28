import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Share2 } from 'lucide-react';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import type { EntrySource } from '../../../../../domain/types/contentType';
import { contentEntryPath } from '../../../../../domain/contentEntryPath';

const messages = defineMessages({
    title: {
        id: 'content.editor.sharedTitle',
        defaultMessage: 'Shared from {workspaceName}'
    },
    body: {
        id: 'content.editor.sharedBody',
        defaultMessage: 'Read-only in this workspace.'
    },
    openInSource: {
        id: 'content.editor.sharedOpenInSource',
        defaultMessage: 'Open in source'
    }
});

/**
 * The banner over an entry read from a **shared** workspace: where it comes
 * from, that it can't be changed here, and — when the reader is a member of
 * that workspace — a link to the same record there, which is where it is
 * edited.
 *
 * The link is offered only to members because the workspace list is the
 * reader's own memberships (`GET /api/workspaces`): for anyone else the
 * destination is the shell's no-access page, a link that only leads to a
 * refusal. It stays hidden while the list is loading or failed, for the same
 * reason — nothing is lost, the banner still says where the record lives.
 *
 * Page furniture from first paint, like `ReadOnlyNotice` beside it, so it is
 * deliberately not a live region.
 */
export function SharedEntryNotice({
    source,
    typeName,
    entryId
}: {
    /** The shared workspace the record lives in. */
    source: EntrySource;
    /** The record's content type (the same in both workspaces). */
    typeName: string;
    /** The record's id (the same in both workspaces). */
    entryId: string;
}) {
    const intl = useIntl();
    const { data: workspaces } = useWorkspaces();
    const isMember = !!workspaces?.some(
        (workspace) => workspace.id === source.workspaceId
    );

    return (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info-soft-foreground">
            <Share2 className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0">
                    <span className="font-medium">
                        {intl.formatMessage(messages.title, {
                            workspaceName: source.workspaceName
                        })}
                    </span>{' '}
                    {intl.formatMessage(messages.body)}
                </p>
                {isMember ? (
                    <Link
                        to={contentEntryPath(
                            source.workspaceId,
                            typeName,
                            entryId
                        )}
                        className="inline-flex shrink-0 items-center gap-1 font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                        {intl.formatMessage(messages.openInSource)}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                ) : null}
            </div>
        </div>
    );
}
