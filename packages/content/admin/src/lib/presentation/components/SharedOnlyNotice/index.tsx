import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Share2 } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import type { ContentType } from '../../../domain/types/contentType';
import { accessOf } from '../../../domain/contentTypeAccess';
import { sharedRecordsPath } from '../../../domain/contentEntryPath';

const messages = defineMessages({
    title: {
        id: 'content.sharedOnly.title',
        defaultMessage: '{label} comes from shared workspaces.'
    },
    body: {
        id: 'content.sharedOnly.body',
        defaultMessage:
            'This workspace can view and link these records, but can’t create its own.'
    },
    open: {
        id: 'content.sharedOnly.open',
        defaultMessage: 'View {label} from {workspace}'
    }
});

/**
 * Said wherever a type's **own** records would be — its records list or a
 * page's editor — when the workspace reaches the type only through shared
 * grants: there is nothing of its own to list and nothing it may create. Links
 * to each source's read-only view, which is where the records actually are.
 *
 * Page furniture from first paint, like `SharedEntryNotice`, so it is
 * deliberately not a live region.
 */
export function SharedOnlyNotice({
    type,
    basePath,
    className
}: {
    /** The shared-only type. */
    type: ContentType;
    /** Absolute base path for the library (`/workspaces/:id/content`). */
    basePath: string;
    className?: string;
}) {
    const intl = useIntl();
    const sources = accessOf(type).sharedSources;
    return (
        <div
            className={cn(
                'flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info-soft-foreground',
                className
            )}
        >
            <Share2 className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="min-w-0">
                    <span className="font-medium">
                        {intl.formatMessage(messages.title, {
                            label: type.label
                        })}
                    </span>{' '}
                    {intl.formatMessage(messages.body)}
                </p>
                {sources.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                        {sources.map((source) => (
                            <li key={source.workspaceId}>
                                <Link
                                    to={sharedRecordsPath(
                                        basePath,
                                        type.name,
                                        source.workspaceId
                                    )}
                                    className="rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {intl.formatMessage(messages.open, {
                                        label: type.label,
                                        workspace: source.workspaceName
                                    })}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </div>
    );
}
