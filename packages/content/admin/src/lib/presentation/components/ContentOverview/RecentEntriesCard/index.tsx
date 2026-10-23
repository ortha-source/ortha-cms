import { defineMessages, useIntl } from 'react-intl';
import { Skeleton } from '@orthacms/design-system';
import { CONTENT_TYPE_KIND } from '../../../../domain/constants';
import { contentEntryPath } from '../../../../domain/contentEntryPath';
import type { RecentEntry } from '../../../../application/useRecentEntries';
import { RecentEntryRow } from './RecentEntryRow';

const messages = defineMessages({
    title: {
        id: 'content.overview.recent.title',
        defaultMessage: 'Recently edited'
    },
    empty: {
        id: 'content.overview.recent.empty',
        defaultMessage:
            'Nothing here yet. Records appear as soon as someone saves one.'
    },
    error: {
        id: 'content.overview.recent.error',
        defaultMessage: 'The latest records could not be loaded.'
    }
});

type RecentEntriesCardProps = {
    entries: RecentEntry[];
    isPending: boolean;
    isError: boolean;
    workspaceId: string;
    basePath: string;
};

/** The overview's "Recently edited" card — the newest saves across types. */
export function RecentEntriesCard({
    entries,
    isPending,
    isError,
    workspaceId,
    basePath
}: RecentEntriesCardProps) {
    const intl = useIntl();

    let body;
    if (isPending) {
        body = (
            <ul aria-hidden>
                {[0, 1, 2, 3].map((row) => (
                    <li
                        key={row}
                        className="flex h-11 items-center gap-2.5 border-t px-3.5"
                    >
                        <Skeleton className="size-7 rounded-lg" />
                        <Skeleton className="h-4 flex-1" />
                    </li>
                ))}
            </ul>
        );
    } else if (isError || entries.length === 0) {
        body = (
            <p className="border-t px-3.5 py-5 text-[13px] text-muted-foreground">
                {intl.formatMessage(isError ? messages.error : messages.empty)}
            </p>
        );
    } else {
        body = (
            <ul>
                {entries.map((item) => (
                    <RecentEntryRow
                        key={`${item.type.name}:${item.id}`}
                        item={item}
                        to={
                            item.type.kind === CONTENT_TYPE_KIND.Single
                                ? `${basePath}/${item.type.name}`
                                : contentEntryPath(
                                      workspaceId,
                                      item.type.name,
                                      item.id
                                  )
                        }
                    />
                ))}
            </ul>
        );
    }

    return (
        <section
            aria-labelledby="content-overview-recent"
            className="overflow-hidden rounded-xl border bg-card"
        >
            <h2
                id="content-overview-recent"
                className="px-3.5 py-2.5 text-sm font-semibold leading-5"
            >
                {intl.formatMessage(messages.title)}
            </h2>
            {body}
        </section>
    );
}
