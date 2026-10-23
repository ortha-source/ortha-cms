import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Badge, Skeleton } from '@orthacms/design-system';
import { useContentUnshipped } from '../../../../application/useContentInsights';

const messages = defineMessages({
    title: {
        id: 'content.overview.notLive.title',
        defaultMessage: 'Not live yet'
    },
    summary: {
        id: 'content.overview.notLive.summary',
        defaultMessage:
            '{modified, number} of {live, number} live {live, plural, one {record has} other {records have}} saved changes that aren’t published.'
    },
    modified: {
        id: 'content.overview.notLive.modified',
        defaultMessage: '{count, number} modified'
    },
    neverPublished: {
        id: 'content.overview.notLive.neverPublished',
        defaultMessage:
            '{count, plural, one {# draft has} other {# drafts have}} never been published.'
    },
    clear: {
        id: 'content.overview.notLive.clear',
        defaultMessage: 'Everything saved is live.'
    },
    nothingLive: {
        id: 'content.overview.notLive.nothingLive',
        defaultMessage: 'Nothing has been published in this workspace yet.'
    },
    error: {
        id: 'content.overview.notLive.error',
        defaultMessage: 'The publishing backlog could not be loaded.'
    }
});

type NotLiveCardProps = {
    /** Type names this workspace may open — a row for any other is dropped. */
    reachable: ReadonlySet<string>;
    basePath: string;
};

/**
 * The overview's "Not live yet" card: live records whose saved edits are not
 * published, per type, with the never-published drafts as a footnote — the
 * same split Insights' "Waiting to go live" draws, said where an editor lands.
 */
export function NotLiveCard({ reachable, basePath }: NotLiveCardProps) {
    const intl = useIntl();
    const { data, isPending, isError } = useContentUnshipped();
    const rows = (data?.types ?? []).filter((type) => reachable.has(type.name));

    let body;
    if (isPending) {
        body = (
            <div aria-hidden className="flex flex-col gap-2 px-3.5 pb-3.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        );
    } else if (isError || !data) {
        body = (
            <p className="px-3.5 pb-3.5 text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.error)}
            </p>
        );
    } else {
        body = (
            <>
                <p className="px-3.5 pb-2.5 text-xs text-muted-foreground">
                    {data.live === 0
                        ? intl.formatMessage(messages.nothingLive)
                        : data.modified === 0
                          ? intl.formatMessage(messages.clear)
                          : intl.formatMessage(messages.summary, {
                                modified: data.modified,
                                live: data.live
                            })}
                </p>
                {rows.length > 0 ? (
                    <ul>
                        {rows.map((type) => (
                            <li key={type.name} className="border-t">
                                <Link
                                    to={`${basePath}/${type.name}`}
                                    className="flex h-9 items-center gap-2.5 px-3.5 text-[13px] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {type.label}
                                    </span>
                                    <Badge variant="warning" size="xs">
                                        {intl.formatMessage(messages.modified, {
                                            count: type.modified
                                        })}
                                    </Badge>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {data.neverPublished > 0 ? (
                    <p className="border-t px-3.5 py-2.5 text-[11px] text-muted-foreground">
                        {intl.formatMessage(messages.neverPublished, {
                            count: data.neverPublished
                        })}
                    </p>
                ) : null}
            </>
        );
    }

    return (
        <section
            aria-labelledby="content-overview-not-live"
            className="overflow-hidden rounded-xl border bg-card"
        >
            <h2
                id="content-overview-not-live"
                className="px-3.5 pt-2.5 pb-1 text-sm font-semibold leading-5"
            >
                {intl.formatMessage(messages.title)}
            </h2>
            {body}
        </section>
    );
}
