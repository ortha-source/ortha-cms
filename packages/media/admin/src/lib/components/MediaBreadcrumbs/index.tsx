import { Fragment } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import { ChevronRight } from 'lucide-react';
import { ROOT_FOLDER_ID } from '../../constants';
import type { MediaFolder } from '../../types/mediaFolder';

/** Intl descriptors for {@link MediaBreadcrumbs}, co-located. */
const messages = defineMessages({
    label: { id: 'media.breadcrumbs.label', defaultMessage: 'Folder path' },
    root: { id: 'media.breadcrumbs.root', defaultMessage: 'All media' }
});

/**
 * The folder path above the browser — "All media" followed by each ancestor up
 * to the open folder, chevron-separated. Every crumb but the last is a button
 * that navigates to that folder; the last is the current location (not a link).
 */
export function MediaBreadcrumbs({
    breadcrumbs,
    onNavigate
}: {
    breadcrumbs: MediaFolder[];
    onNavigate: (folderId: string) => void;
}) {
    const intl = useIntl();

    const crumbs = [
        { id: ROOT_FOLDER_ID, name: intl.formatMessage(messages.root) },
        ...breadcrumbs.map((folder) => ({ id: folder.id, name: folder.name }))
    ];

    return (
        <nav aria-label={intl.formatMessage(messages.label)}>
            <ol className="flex flex-wrap items-center gap-1 text-sm">
                {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;
                    return (
                        <Fragment key={crumb.id}>
                            <li>
                                {isLast ? (
                                    <span
                                        className="font-semibold text-foreground"
                                        aria-current="page"
                                    >
                                        {crumb.name}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(crumb.id)}
                                        className={cn(
                                            'rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                        )}
                                    >
                                        {crumb.name}
                                    </button>
                                )}
                            </li>
                            {isLast ? null : (
                                <li aria-hidden className="text-muted-foreground/60">
                                    <ChevronRight className="size-3.5" />
                                </li>
                            )}
                        </Fragment>
                    );
                })}
            </ol>
        </nav>
    );
}
