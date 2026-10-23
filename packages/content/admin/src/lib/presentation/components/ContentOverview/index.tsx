import { defineMessages, useIntl } from 'react-intl';
import { CONTENT_TYPE_KIND } from '../../../domain/constants';
import type { ContentType } from '../../../domain/types/contentType';
import {
    useContentPipeline,
    useContentUnshipped
} from '../../../application/useContentInsights';
import { useRecentEntries } from '../../../application/useRecentEntries';
import { RecentEntriesCard } from './RecentEntriesCard';
import { NotLiveCard } from './NotLiveCard';
import { ContentTypeCard, type StatusSplit } from './ContentTypeCard';

const messages = defineMessages({
    entries: {
        id: 'content.overview.meta.entries',
        defaultMessage: '{count, plural, one {# record} other {# records}}'
    },
    kinds: {
        id: 'content.overview.meta.kinds',
        defaultMessage:
            '{collections, plural, one {# collection} other {# collections}}, {pages, plural, one {# page} other {# pages}}'
    },
    collections: {
        id: 'content.overview.collections',
        defaultMessage: 'Collections'
    },
    pages: {
        id: 'content.overview.pages',
        defaultMessage: 'Pages'
    },
    legendPublished: {
        id: 'content.overview.legend.published',
        defaultMessage: 'Published'
    },
    legendModified: {
        id: 'content.overview.legend.modified',
        defaultMessage: 'Modified'
    },
    legendDrafts: {
        id: 'content.overview.legend.drafts',
        defaultMessage: 'Draft'
    }
});

type ContentOverviewProps = {
    workspaceId: string;
    workspaceName: string;
    /** The workspace's scoped catalogue (`scopeContentTypes`). */
    types: readonly ContentType[];
    /** The library's mount, `/workspaces/:id/content`. */
    basePath: string;
};

/**
 * The Content Library's landing, before a type is picked: the workspace's
 * name over how much it holds, what was saved last, what is saved but not
 * live, and a card per collection and page.
 *
 * Only the workspace's **own** types are summarised — a shared-only type has
 * no records here to count, and its source's are reached from the sidebar.
 */
export function ContentOverview({
    workspaceId,
    workspaceName,
    types,
    basePath
}: ContentOverviewProps) {
    const intl = useIntl();
    const own = types.filter((type) => type.access?.own ?? true);
    const collections = own.filter(
        (type) => type.kind === CONTENT_TYPE_KIND.Collection
    );
    const pages = own.filter((type) => type.kind === CONTENT_TYPE_KIND.Single);
    const recent = useRecentEntries(own);
    const pipeline = useContentPipeline();
    const unshipped = useContentUnshipped();
    const reachable = new Set(own.map((type) => type.name));

    const known = [...recent.byType.values()];
    const total =
        known.length > 0
            ? known.reduce((sum, type) => sum + type.total, 0)
            : undefined;

    const splitOf = (type: ContentType): StatusSplit | null => {
        if (!type.publishable) return null;
        const row = pipeline.data?.types.find((t) => t.name === type.name);
        if (!row) return null;
        const modified =
            unshipped.data?.types.find((t) => t.name === type.name)?.modified ??
            0;
        return {
            published: row.published,
            modified: Math.min(modified, row.drafts),
            drafts: Math.max(0, row.drafts - modified)
        };
    };

    const card = (type: ContentType) => {
        const activity = recent.byType.get(type.name);
        return (
            <li key={type.name}>
                <ContentTypeCard
                    type={type}
                    to={`${basePath}/${type.name}`}
                    total={activity?.total}
                    updatedAt={activity?.updatedAt ?? null}
                    split={splitOf(type)}
                    single={activity?.first ?? null}
                />
            </li>
        );
    };

    const showLegend = collections.some((type) => type.publishable);

    return (
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-7 px-4 py-8 sm:px-10">
            <header className="flex flex-col gap-1.5">
                {/* The page's `<h1>` while no type is picked (`ORT-167`). */}
                <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.012em]">
                    {workspaceName}
                </h1>
                <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    {total !== undefined ? (
                        <>
                            <span>
                                {intl.formatMessage(messages.entries, {
                                    count: total
                                })}
                            </span>
                            <span aria-hidden>·</span>
                        </>
                    ) : null}
                    <span>
                        {intl.formatMessage(messages.kinds, {
                            collections: collections.length,
                            pages: pages.length
                        })}
                    </span>
                </p>
            </header>

            {own.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                    <RecentEntriesCard
                        entries={recent.entries}
                        isPending={recent.isPending}
                        isError={recent.isError}
                        workspaceId={workspaceId}
                        basePath={basePath}
                    />
                    <NotLiveCard reachable={reachable} basePath={basePath} />
                </div>
            ) : null}

            {collections.length > 0 ? (
                <section
                    aria-labelledby="content-overview-collections"
                    className="flex flex-col gap-3"
                >
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h2
                            id="content-overview-collections"
                            className="text-[15px] font-semibold leading-5"
                        >
                            {intl.formatMessage(messages.collections)}
                        </h2>
                        {showLegend ? (
                            // The bars are decoration: each card says its
                            // counts in words under its bar.
                            <div
                                aria-hidden
                                className="flex gap-3 text-xs text-muted-foreground"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-1.5 rounded-full bg-success" />
                                    {intl.formatMessage(
                                        messages.legendPublished
                                    )}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-1.5 rounded-full bg-warning" />
                                    {intl.formatMessage(
                                        messages.legendModified
                                    )}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-1.5 rounded-full bg-muted-foreground/45" />
                                    {intl.formatMessage(messages.legendDrafts)}
                                </span>
                            </div>
                        ) : null}
                    </div>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {collections.map(card)}
                    </ul>
                </section>
            ) : null}

            {pages.length > 0 ? (
                <section
                    aria-labelledby="content-overview-pages"
                    className="flex flex-col gap-3"
                >
                    <h2
                        id="content-overview-pages"
                        className="text-[15px] font-semibold leading-5"
                    >
                        {intl.formatMessage(messages.pages)}
                    </h2>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {pages.map(card)}
                    </ul>
                </section>
            ) : null}
        </div>
    );
}
