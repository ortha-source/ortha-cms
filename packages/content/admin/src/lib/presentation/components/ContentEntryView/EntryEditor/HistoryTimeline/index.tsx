import { useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    SegmentedControl,
    SegmentedControlItem,
    Spinner
} from '@orthacms/design-system';
import type { ContentTypeDetail } from '../../../../../domain/types/contentType';
import {
    HISTORY_FILTER,
    HISTORY_SHOW_PARAM,
    type HistoryFilter
} from '../../../../../domain/constants';
import { useEntryRevisions } from '../../../../../application/useEntryRevisions';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import {
    ENTRY_TIMELINE_SLOT,
    type EntryTimelineSource
} from '../../../../slots/contentSlots';
import { RevisionList } from '../RevisionList';

const messages = defineMessages({
    title: { id: 'content.revisions.historyTitle', defaultMessage: 'History' },
    body: {
        id: 'content.revisions.historyBody',
        defaultMessage:
            'Every save is kept as a version. Restore an earlier one to bring it back — it’s re-applied as a new revision, so nothing is lost.'
    },
    unsaved: {
        id: 'content.revisions.historyUnsaved',
        defaultMessage: 'Save this record to start its version history.'
    },
    empty: {
        id: 'content.revisions.historyEmpty',
        defaultMessage: 'No versions yet.'
    },
    emptyActivity: {
        id: 'content.revisions.historyEmptyActivity',
        defaultMessage: 'Nothing has been recorded for this record yet.'
    },
    error: {
        id: 'content.revisions.historyError',
        defaultMessage: 'Couldn’t load version history.'
    },
    sourceError: {
        id: 'content.revisions.historySourceError',
        defaultMessage:
            'Activity could not be loaded, so the timeline shows versions only.'
    },
    filter: { id: 'content.revisions.filter', defaultMessage: 'Show' },
    all: { id: 'content.revisions.filterAll', defaultMessage: 'All' },
    versions: {
        id: 'content.revisions.filterVersions',
        defaultMessage: 'Versions'
    }
});

/** The filter values a URL may carry; anything else reads as All. */
const FILTERS: readonly string[] = Object.values(HISTORY_FILTER);

/**
 * The **History** view: one timeline, newest first, grouped by day — the
 * entry's versions (`RevisionList`, the **one** place they are read,
 * previewed, restored and published from) with whatever the timeline sources
 * add between them (`ENTRY_TIMELINE_SLOT`: the record's activity). An
 * **All · Versions · Activity** filter picks which, kept in the URL
 * (`?show=`) so the retired Activity tab's links land on it.
 *
 * A source the reader may not see returns `null`, and then the filter does
 * not offer it: the timeline is the version list. It sits at the same level
 * as the Content view — no card around it.
 */
export function HistoryTimeline({
    typeName,
    entryId,
    schema
}: {
    typeName: string;
    entryId?: string;
    /** The type's full field schema — threaded to the preview diff. */
    schema: ContentTypeDetail;
}) {
    const intl = useIntl();
    const slotContext = useEntrySlotContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data, isLoading, isError } = useEntryRevisions(typeName, entryId);
    const revisions = data?.items ?? [];

    // Every source's hook, every render — boot-frozen, so the order holds.
    const sources: {
        id: string;
        label: string;
        source: EntryTimelineSource;
    }[] = [];
    for (const item of ENTRY_TIMELINE_SLOT.getItems()) {
        const source = slotContext ? item.useEvents(slotContext) : null;
        if (source)
            sources.push({
                id: item.id,
                label: intl.formatMessage(item.label),
                source
            });
    }

    const raw = searchParams.get(HISTORY_SHOW_PARAM) ?? HISTORY_FILTER.All;
    const filter = (
        sources.length > 0 && FILTERS.includes(raw) ? raw : HISTORY_FILTER.All
    ) as HistoryFilter;
    const setFilter = (next: string) => {
        if (!next) return;
        setSearchParams(
            (current) => {
                const params = new URLSearchParams(current);
                if (next === HISTORY_FILTER.All)
                    params.delete(HISTORY_SHOW_PARAM);
                else params.set(HISTORY_SHOW_PARAM, next);
                return params;
            },
            { replace: true }
        );
    };

    const showVersions = filter !== HISTORY_FILTER.Activity;
    const showEvents = filter !== HISTORY_FILTER.Versions;
    const events = showEvents
        ? sources.flatMap(({ source }) => source.events)
        : [];
    const shownRevisions = showVersions ? revisions : [];
    // Only the Activity view waits on its sources: under All, the versions
    // are drawn the moment they land and the activity joins them when it
    // does — a slow or failing source must never hold the version list.
    const sourcesPending =
        filter === HISTORY_FILTER.Activity &&
        sources.some(({ source }) => source.isPending);
    const sourcesFailed =
        showEvents && sources.some(({ source }) => source.isError);

    const body = !entryId ? (
        <p className="text-sm text-muted-foreground">
            {intl.formatMessage(messages.unsaved)}
        </p>
    ) : (showVersions && isLoading) || sourcesPending ? (
        <div className="flex justify-center py-4">
            <Spinner />
        </div>
    ) : showVersions && isError ? (
        <p className="text-sm text-muted-foreground">
            {intl.formatMessage(messages.error)}
        </p>
    ) : shownRevisions.length === 0 &&
      events.length === 0 &&
      sourcesFailed ? // empty-state line beside it would claim the opposite. // "Could not be loaded" is already said above; an
    null : shownRevisions.length === 0 && events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
            {intl.formatMessage(
                filter === HISTORY_FILTER.Activity
                    ? messages.emptyActivity
                    : messages.empty
            )}
        </p>
    ) : (
        <RevisionList
            typeName={typeName}
            entryId={entryId}
            schema={schema}
            revisions={shownRevisions}
            events={events}
        />
    );

    return (
        <section
            aria-labelledby="entry-history-title"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex max-w-xl flex-col gap-1">
                    <h2
                        id="entry-history-title"
                        className="text-base font-semibold"
                    >
                        {intl.formatMessage(messages.title)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.body)}
                    </p>
                </div>
                {sources.length > 0 && entryId ? (
                    <SegmentedControl
                        aria-label={intl.formatMessage(messages.filter)}
                        value={filter}
                        onValueChange={setFilter}
                    >
                        <SegmentedControlItem value={HISTORY_FILTER.All}>
                            {intl.formatMessage(messages.all)}
                        </SegmentedControlItem>
                        <SegmentedControlItem value={HISTORY_FILTER.Versions}>
                            {intl.formatMessage(messages.versions)}
                        </SegmentedControlItem>
                        <SegmentedControlItem value={HISTORY_FILTER.Activity}>
                            {sources.map(({ label }) => label).join(' · ')}
                        </SegmentedControlItem>
                    </SegmentedControl>
                ) : null}
            </div>
            {sourcesFailed ? (
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.sourceError)}
                </p>
            ) : null}
            {body}
        </section>
    );
}
