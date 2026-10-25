import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { ChangedBadge, type EntryTabContext } from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDebouncedValue } from '@orthacms/utils-admin';
import {
    Button,
    Input,
    SegmentedControl,
    SegmentedControlCount,
    SegmentedControlItem,
    Skeleton,
    cn
} from '@orthacms/design-system';
import {
    sameAccess,
    stateOf,
    withState,
    withStates,
    OPEN_ACCESS,
    type EntryAccess,
    type EntryAccessStaging,
    type Segment,
    type SegmentState
} from '../../../domain/types';
import {
    SEGMENTS_MANAGE,
    useEntryAccess,
    useSegmentLookup,
    useSegments
} from '../../../application/hooks';
import { ENTRY_ACCESS_PRESAVE_ID } from '../../../application/useEntryAccessPresave';
import { SegmentStateControl } from '../SegmentStateControl';
import { SegmentsPagination } from '../SegmentsPagination';
import { EntryAccessBulkActions } from '../EntryAccessBulkActions';
import { AccessLine } from './AccessLine';

const messages = defineMessages({
    body: {
        id: 'segments.entryTab.body',
        defaultMessage:
            'Set each audience to “Can see” or “Cannot see”. Leave one unset and it follows the rest: with nothing set to “Can see”, everybody reads the entry; set one, and only the audiences you named do. “Cannot see” always wins.'
    },
    pending: {
        id: 'segments.entryTab.pending',
        defaultMessage: 'Access is saved with the entry.'
    },
    readOnly: {
        id: 'segments.entryTab.readOnly',
        defaultMessage:
            'You can see who reads this, but changing it needs the “segments:manage” permission.'
    },
    noneHere: {
        id: 'segments.entryTab.noneHere',
        defaultMessage:
            'No audience is offered in this workspace yet. Open Segments to create one, or to widen where an existing one applies.'
    },
    noMatches: {
        id: 'segments.entryTab.noMatches',
        defaultMessage: 'No audience matches “{query}”.'
    },
    search: {
        id: 'segments.entryTab.search',
        defaultMessage: 'Search audiences'
    },
    manage: {
        id: 'segments.entryTab.manage',
        defaultMessage: 'Manage segments'
    },
    table: { id: 'segments.entryTab.table', defaultMessage: 'Audiences' },
    audienceColumn: {
        id: 'segments.entryTab.audienceColumn',
        defaultMessage: 'Audience'
    },
    accessColumn: {
        id: 'segments.entryTab.accessColumn',
        defaultMessage: 'Access'
    },
    pendingEveryLocale: {
        id: 'segments.entryTab.pendingEveryLocale',
        defaultMessage:
            'Access is saved with the entry and applies to every language of the record, not to this translation alone.'
    },
    filterLabel: {
        id: 'segments.entryTab.filterLabel',
        defaultMessage: 'Show audiences'
    },
    filterAll: { id: 'segments.entryTab.filterAll', defaultMessage: 'All' },
    filterSet: { id: 'segments.entryTab.filterSet', defaultMessage: 'Set' },
    filterOption: {
        id: 'segments.entryTab.filterOption',
        defaultMessage: '{label}, {count}'
    },
    noneSet: {
        id: 'segments.entryTab.noneSet',
        defaultMessage:
            'No audience is set on this entry yet, so everyone can read it.'
    },
    elsewhere: {
        id: 'segments.entryTab.elsewhere',
        defaultMessage:
            '{count, plural, one {# more decision} other {# more decisions}} on audiences this list does not show. They still apply.'
    }
});

/** Rows per page before anyone changes it. */
const DEFAULT_PAGE_SIZE = 10;

/** Which rows the table shows: every audience offered here, or the set ones. */
const ROWS = { All: 'all', Set: 'set' } as const;
type Rows = (typeof ROWS)[keyof typeof ROWS];

/** Whether an audience matches the search, as the server's `q` does. */
function matches(segment: Segment, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        segment.label.toLowerCase().includes(needle) ||
        segment.key.toLowerCase().includes(needle)
    );
}

/**
 * The entry editor's **Access** tab — the whole feature, from an editor's side.
 *
 * One row per audience, each with the three-state control. There is nothing else
 * on this tab because there is nothing else in the model: no rule to pick, no
 * level to inherit from, no window. What is set here is what a reader is matched
 * against on the next request.
 *
 * **The list is scoped to the open workspace**, so an editor is offered the
 * audiences their workspace was given rather than the whole installation's
 * vocabulary. Decisions already made on audiences the list does not show — one a
 * search hides, one narrowed away from this workspace since — are **kept** and
 * counted below it. Dropping them would rewrite who can read published content
 * from a screen that never mentioned them.
 *
 * **It has no Save button, on purpose.** Who may read a record is part of the
 * record, so it rides the editor's own Save / Publish like a field does —
 * staged here, sent in the save body, written by the server inside the save's
 * own transaction and captured by the revision it appends.
 *
 * The staging lives **above this component** ({@link EntryAccessStaging},
 * reached through `presave`) because editor tabs are routes: this panel unmounts
 * the moment the user switches tab, and an unsaved decision must not go with it.
 */
export function EntryAccessTab({
    workspaceId,
    schema,
    entry,
    readOnly,
    presave
}: EntryTabContext) {
    const intl = useIntl();
    // Two gates, and they are not the same one. `readOnly` says the caller may
    // not edit this entry's *values*; `segments:manage` says they may not
    // change who reads it. An editor with `content:update` and neither should
    // be able to rewrite the article and not to publish it to a new audience.
    const canManage = useHasPermission(SEGMENTS_MANAGE);

    const [query, setQuery] = useState('');
    const [rows, setRows] = useState<Rows>(ROWS.All);
    // The ids the "Set" view was opened with. A row put back to "Not set"
    // while the view is on stays in it until the view changes, so it does not
    // vanish from under the cursor that just changed it.
    const [pinned, setPinned] = useState<string[]>([]);
    const [rulesOpen, setRulesOpen] = useState(false);
    const debounced = useDebouncedValue(query, 250);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    // A narrowed search almost always has fewer pages than the one before it,
    // so staying on page four is how a reader lands on "no matches" for a term
    // that matches plenty.
    useEffect(() => setPage(1), [debounced, pageSize, rows]);

    const segments = useSegments({
        query: debounced || undefined,
        workspaceId,
        page,
        pageSize
    });
    // Nothing on this tab deletes an audience, but the directory can still
    // shrink under the page it is on — another administrator deleting one, and
    // a focus refetch bringing back the smaller total — and that page then
    // answers with no rows. Same clamp as the directory page, and the same
    // `!isPlaceholderData` guard, so it reads the fresh total.
    const segmentsPageCount = Math.max(
        1,
        Math.ceil((segments.data?.total ?? 0) / pageSize)
    );
    useEffect(() => {
        if (
            rows === ROWS.All &&
            segments.data &&
            !segments.isPlaceholderData &&
            page > segmentsPageCount
        ) {
            setPage(segmentsPageCount);
        }
    }, [
        rows,
        segments.data,
        segments.isPlaceholderData,
        page,
        segmentsPageCount
    ]);

    const saved = useEntryAccess(workspaceId, entry?.id, entry?.updatedAt);
    const staging = presave[ENTRY_ACCESS_PRESAVE_ID] as
        | EntryAccessStaging
        | undefined;

    // What the entry is set to now, and what the next save will make of it. On a
    // create there is nothing saved to read, so the base is open access — which
    // is what an entry that nobody has restricted is.
    const savedAccess = saved.data ?? OPEN_ACCESS;
    const draft = staging?.draft ?? savedAccess;
    const dirty = Boolean(staging?.draft);

    // Every audience the entry decides about, whatever page or search it would
    // fall on — read by id, because the paginated list cannot promise them.
    // It is the "Set" view's rows.
    const setIds = useMemo(
        () => [...draft.allow, ...draft.deny],
        [draft.allow, draft.deny]
    );
    const setViewIds = useMemo(
        () => [...new Set([...pinned, ...setIds])],
        [pinned, setIds]
    );
    const decided = useSegmentLookup(setViewIds, { keepPrevious: true });

    // The read is disabled without an entry id, so it never resolves on a create
    // — waiting on it there would leave the tab on skeletons forever.
    if (segments.isPending || (entry && saved.isPending)) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    const allRows = segments.data?.items ?? [];
    const allTotal = segments.data?.total ?? 0;
    const matchedIds = segments.data?.ids ?? [];
    const locked = readOnly || !canManage || !staging;

    // The "Set" view, paged here: the ids it was opened with plus anything set
    // since, by label, narrowed by the same search the server applies.
    const setView = (decided.data ?? []).filter(
        (segment) =>
            setViewIds.includes(segment.id) && matches(segment, debounced)
    );
    const setCount = debounced
        ? setView.filter((segment) => setIds.includes(segment.id)).length
        : setIds.length;
    const showingSet = rows === ROWS.Set;
    const total = showingSet ? setView.length : allTotal;
    const pageCount = showingSet
        ? Math.max(1, Math.ceil(setView.length / pageSize))
        : segmentsPageCount;
    const shownPage = Math.min(page, pageCount);
    const list = showingSet
        ? setView.slice((shownPage - 1) * pageSize, shownPage * pageSize)
        : allRows;

    // Nothing offered here at all — a different situation from a search that
    // matched nothing, and it needs a different sentence: the first is a setup
    // step, the second is a typo.
    if (allTotal === 0 && !debounced) {
        return (
            <div className="flex flex-col items-start gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noneHere)}
                </p>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/segments">
                        <ShieldCheck aria-hidden />
                        {intl.formatMessage(messages.manage)}
                    </Link>
                </Button>
            </div>
        );
    }

    /** Decisions on audiences this list does not cover — kept, and counted. */
    const listed = new Set(
        showingSet ? setView.map((segment) => segment.id) : matchedIds
    );
    const elsewhere = [...draft.allow, ...draft.deny].filter(
        (id) => !listed.has(id)
    ).length;

    const stage = (next: EntryAccess) => {
        // Staging what is already stored would light the Changed badge and cost
        // a write for a round trip back to where the entry started.
        staging?.stage(sameAccess(next, savedAccess) ? null : next);
    };

    const changedRow = (id: string) =>
        stateOf(draft, id) !== stateOf(savedAccess, id);

    return (
        <div className="flex flex-col gap-5">
            {/* What it adds up to, in one line, right over the toolbar —
                the outcome and the one rule the rows do not say. */}
            <div className="-mb-2 flex flex-col gap-1">
                <AccessLine
                    access={draft}
                    dirty={dirty}
                    rulesOpen={rulesOpen}
                    onToggleRules={() => setRulesOpen((open) => !open)}
                    rulesId="entry-access-rules"
                />
                {rulesOpen ? (
                    <p
                        id="entry-access-rules"
                        className="ml-6 max-w-xl text-[13px] leading-[18px] text-muted-foreground"
                    >
                        {intl.formatMessage(messages.body)}
                    </p>
                ) : null}
            </div>

            {/* Search across the row, then the two ways to act on many at
                once: set them all, or go and manage the audiences. */}
            <div className="flex flex-wrap items-center gap-2">
                {/* All or only the decided ones, beside the search that
                    narrows either. Rows keep their order in both: sorting the
                    set ones to the top would move them under the cursor. */}
                <SegmentedControl
                    value={rows}
                    onValueChange={(next) => {
                        // A single toggle group can be cleared; it cannot be
                        // "no view".
                        if (next !== ROWS.All && next !== ROWS.Set) return;
                        setPinned(next === ROWS.Set ? setIds : []);
                        setRows(next);
                    }}
                    aria-label={intl.formatMessage(messages.filterLabel)}
                >
                    {[
                        {
                            value: ROWS.All,
                            label: intl.formatMessage(messages.filterAll),
                            count: allTotal
                        },
                        {
                            value: ROWS.Set,
                            label: intl.formatMessage(messages.filterSet),
                            count: setCount
                        }
                    ].map((option) => (
                        <SegmentedControlItem
                            key={option.value}
                            value={option.value}
                            aria-label={intl.formatMessage(
                                messages.filterOption,
                                option
                            )}
                        >
                            {option.label}
                            <SegmentedControlCount aria-hidden>
                                {option.count}
                            </SegmentedControlCount>
                        </SegmentedControlItem>
                    ))}
                </SegmentedControl>
                <div className="relative min-w-48 flex-1">
                    <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                    />
                    <Input
                        className="h-8 pl-8"
                        type="search"
                        value={query}
                        aria-label={intl.formatMessage(messages.search)}
                        placeholder={intl.formatMessage(messages.search)}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                {locked || showingSet ? null : (
                    <EntryAccessBulkActions
                        count={total}
                        searching={Boolean(debounced)}
                        truncated={segments.data?.idsTruncated ?? false}
                        onApply={(state: SegmentState) =>
                            stage(withStates(draft, matchedIds, state))
                        }
                    />
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    asChild
                >
                    <Link to="/segments">
                        <ShieldCheck aria-hidden />
                        {intl.formatMessage(messages.manage)}
                    </Link>
                </Button>
            </div>

            {total === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {showingSet && !debounced
                        ? intl.formatMessage(messages.noneSet)
                        : intl.formatMessage(messages.noMatches, {
                              query: debounced
                          })}
                </p>
            ) : (
                <>
                    {/* A page turn or a new search keeps the previous rows
                        on screen (`keepPreviousData`) until the next ones land:
                        they dim after a beat — the design-system Table's
                        `stale` contract — instead of looking current. */}
                    <div
                        className={cn(
                            'overflow-hidden rounded-xl border',
                            'transition-opacity duration-(--ds-duration-base) motion-reduce:transition-none',
                            !showingSet &&
                                segments.isPlaceholderData &&
                                'opacity-60 delay-150'
                        )}
                    >
                        <table
                            aria-busy={
                                (!showingSet && segments.isPlaceholderData) ||
                                undefined
                            }
                            aria-label={intl.formatMessage(messages.table)}
                            className="w-full border-collapse text-sm"
                        >
                            <thead>
                                <tr className="h-9 bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                                    <th className="pl-4 font-medium">
                                        {intl.formatMessage(
                                            messages.audienceColumn
                                        )}
                                    </th>
                                    <th className="w-0 pr-3 font-medium">
                                        {intl.formatMessage(
                                            messages.accessColumn
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((segment) => {
                                    const changed = changedRow(segment.id);
                                    return (
                                        <tr
                                            key={segment.id}
                                            className={cn(
                                                'h-[52px] border-t',
                                                changed && 'bg-warning-soft/45'
                                            )}
                                        >
                                            {/* `w-full max-w-0` lets the
                                                cell give way to the control
                                                and its tag line truncate. */}
                                            <td className="w-full max-w-0 py-2 pl-4">
                                                <span className="flex items-center gap-2 font-medium">
                                                    <span className="line-clamp-2 min-w-0 break-words">
                                                        {segment.label}
                                                    </span>
                                                    {changed ? (
                                                        <ChangedBadge />
                                                    ) : null}
                                                </span>
                                                <span
                                                    className="block truncate font-mono text-[11px] leading-4 text-muted-foreground"
                                                    title={tagLine(segment)}
                                                >
                                                    {tagLine(segment)}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3">
                                                <SegmentStateControl
                                                    name={segment.label}
                                                    value={stateOf(
                                                        draft,
                                                        segment.id
                                                    )}
                                                    disabled={locked}
                                                    onChange={(state) =>
                                                        stage(
                                                            withState(
                                                                draft,
                                                                segment.id,
                                                                state
                                                            )
                                                        )
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <SegmentsPagination
                        page={shownPage}
                        pageCount={pageCount}
                        pageSize={pageSize}
                        total={total}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </>
            )}

            {elsewhere > 0 ? (
                <p className="text-[13px] text-muted-foreground">
                    {intl.formatMessage(messages.elsewhere, {
                        count: elsewhere
                    })}
                </p>
            ) : null}

            {/* Said on screen, because it is the one thing here that is not
                about the record in front of the editor: who may read a record
                is a fact about the record, not about its German wording — so
                it travels like a shared field. */}
            <p className="text-[13px] leading-[18px] text-muted-foreground">
                {intl.formatMessage(
                    locked
                        ? messages.readOnly
                        : schema.i18n
                          ? messages.pendingEveryLocale
                          : messages.pending
                )}
            </p>
        </div>
    );
}

/** An audience's tags as one line — its key when it has none. */
function tagLine(segment: Segment): string {
    return segment.tags.length ? segment.tags.join(', ') : segment.key;
}
