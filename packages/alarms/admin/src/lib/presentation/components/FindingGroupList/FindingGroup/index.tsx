import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Skeleton,
    SkeletonRegion,
    Spinner,
    cn
} from '@orthacms/design-system';
import { ChevronRight, Pencil, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useAlarmFindings } from '../../../../application/useAlarmFindings';
import type { AlarmRule } from '../../../../types/alarm';
import { severityLook } from '../../../severityLook';
import { FindingRow } from '../../FindingRow';
import { FindingsPager } from '../../FindingsPager';

const messages = defineMessages({
    count: {
        id: 'alarms.group.openCount',
        defaultMessage: '<b>{count, number}</b> open'
    },
    subtitle: {
        id: 'alarms.group.subtitle',
        defaultMessage: '{type} · shows editors “{title}”'
    },
    edit: { id: 'alarms.group.edit', defaultMessage: 'Edit' },
    editLabel: {
        id: 'alarms.group.editLabel',
        defaultMessage: 'Edit {name}'
    },
    toggle: {
        id: 'alarms.group.toggle',
        defaultMessage:
            '{severity}: {name} — {count, plural, one {# record} other {# records}}'
    },
    listLabel: {
        id: 'alarms.group.listLabel',
        defaultMessage: 'Records flagged by {name}'
    },
    recheck: { id: 'alarms.group.recheck', defaultMessage: 'Re-check' },
    recheckLabel: {
        id: 'alarms.group.recheckLabel',
        defaultMessage: 'Re-check {name} against the whole collection'
    },
    shown: {
        id: 'alarms.group.shown',
        defaultMessage: '{first, number}–{last, number} of {count, number}'
    },
    shownAll: {
        id: 'alarms.group.shownAll',
        defaultMessage: '{count, number} of {count, number}'
    },
    showAll: {
        id: 'alarms.group.showAll',
        defaultMessage: 'Show all in Records'
    },
    showAllLabel: {
        id: 'alarms.group.showAllLabel',
        defaultMessage: 'Show all in Records: every record {name} flags'
    },
    error: {
        id: 'alarms.group.error',
        defaultMessage:
            'These records could not be loaded, so this is not a statement that the list is empty.'
    },
    gone: {
        id: 'alarms.group.gone',
        defaultMessage: 'Nothing here any more — these records were fixed.'
    },
    loading: {
        id: 'alarms.group.loading',
        defaultMessage: 'Loading the records {name} has flagged…'
    }
});

/** Findings shown per page inside one group. */
const GROUP_PAGE_SIZE = 10;

/** Props for {@link FindingGroup}. */
export type FindingGroupProps = {
    /** The alarm this group is about. */
    rule: AlarmRule;
    /** The collection's display label ("Articles"). */
    typeLabel: string;
    /**
     * How many records this alarm currently flags.
     *
     * **Taken from the alarm, never from the page of findings below it.** A
     * header reading "3 records" over a first page of three, when there are
     * ninety, is the exact misinformation grouping exists to prevent.
     */
    count: number;
    /** Whether this group starts expanded. */
    defaultOpen: boolean;
    /** Whether the caller may rescan (i.e. holds `alarms:manage`). */
    canManage: boolean;
    /** Re-run this alarm over its whole collection. */
    onRescan: (rule: AlarmRule) => void;
    /** A rescan of this alarm is in flight. */
    isRescanning: boolean;
    /** The alarm was just created — its group is highlighted. */
    justCreated?: boolean;
};

/**
 * One alarm and the records it has flagged, collapsed by default.
 *
 * **Why grouping rather than a flat list.** What a person actually does with
 * findings is one alarm at a time — "fourteen articles link to a draft author"
 * is one pass, while fourteen rows about fourteen articles is fourteen context
 * switches. The header carries everything constant across the group: the
 * level, the alarm, what editors are told, how many are open; each row is only
 * what differs — which record, and how long it has been flagged.
 *
 * **The records load when the group is about to open**, not on mount: on hover
 * or focus of its header, so they are usually in by the click. A workspace
 * with twenty alarms would otherwise fire twenty list requests to draw a
 * screen on which nineteen of them are collapsed. While they load, the
 * skeleton has as many rows as the page will — the count is known — so the
 * opening animation measures the final height and nothing jumps when they
 * land.
 *
 * **Each group pages on its own**, ten at a time, and ends in a footer that
 * says how many of how many are on screen and links the whole set into the
 * records list — the alarm's condition *is* a records filter, so "show me all
 * of them" is that list, filtered, rather than a second paging UI here.
 */
export function FindingGroup({
    rule,
    typeLabel,
    count,
    defaultOpen,
    canManage,
    onRescan,
    isRescanning,
    justCreated = false
}: FindingGroupProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(defaultOpen);
    // Hovering or focusing the header starts the fetch, ahead of the click.
    const [warm, setWarm] = useState(false);
    const [page, setPage] = useState(1);
    const { chip, Icon, label } = severityLook(rule.severity);
    const workspace = useCurrentWorkspace();

    const findings = useAlarmFindings(
        { state: 'open', ruleId: rule.id, page, pageSize: GROUP_PAGE_SIZE },
        open || warm
    );

    const pageCount = useMemo(
        () => Math.max(1, Math.ceil(count / GROUP_PAGE_SIZE)),
        [count]
    );

    // A rescan that clears the last row of a trailing page leaves this group's
    // page past the end, and the refetch lands on an empty list with the pager
    // hidden — clamp it.
    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    // Open whenever the parent asks again (an alarm card's "N flagged").
    useEffect(() => {
        if (defaultOpen) setOpen(true);
    }, [defaultOpen]);

    const items = findings.data?.items ?? [];
    const first = (page - 1) * GROUP_PAGE_SIZE + 1;
    // How many rows this page will hold, for a skeleton of the same height.
    const expectedRows = Math.min(
        GROUP_PAGE_SIZE,
        Math.max(1, count - (first - 1))
    );
    const recordsHref = `/workspaces/${workspace.id}/content/${rule.contentType}?filter=${encodeURIComponent(
        JSON.stringify(rule.filter)
    )}`;

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="overflow-hidden rounded-xl border bg-card"
        >
            {/* The trigger covers the chevron and the wording only. Re-check
                and Edit are second actions on the same row, and a `<button>`
                cannot contain another one. The flash tints the header, not the
                card: its keyframes animate `background-color` to transparent. */}
            <div
                className={cn(
                    'flex items-center gap-3 bg-muted/40 px-4 py-3',
                    justCreated && 'ds-flash'
                )}
            >
                <CollapsibleTrigger
                    onPointerEnter={() => setWarm(true)}
                    onFocus={() => setWarm(true)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    // The severity leads the name because `aria-label` on a
                    // button **replaces** its descendant text in the accessible
                    // name: an `sr-only` word inside the trigger is not read at
                    // all, so the severity has to be part of the label itself
                    // or a screen-reader user never hears it (WCAG 1.4.1).
                    aria-label={intl.formatMessage(messages.toggle, {
                        severity: intl.formatMessage(label),
                        name: rule.name,
                        count
                    })}
                >
                    <ChevronRight
                        aria-hidden="true"
                        className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
                            open && 'rotate-90'
                        )}
                    />
                    {/* The severity as a pill: its own glyph and its word, so
                        colour is never the only signal (`alarms:I-32`). */}
                    <span
                        className={cn(
                            'inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs font-medium',
                            chip
                        )}
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                        />
                        {intl.formatMessage(label)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">
                            {rule.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {intl.formatMessage(messages.subtitle, {
                                type: typeLabel,
                                title: rule.findingTitle
                            })}
                        </span>
                    </span>
                </CollapsibleTrigger>

                <span className="shrink-0 text-xs text-muted-foreground">
                    {intl.formatMessage(messages.count, {
                        count,
                        b: (chunks) => (
                            <b
                                key="count"
                                className="mr-1 text-sm font-semibold tabular-nums text-foreground"
                            >
                                {chunks}
                            </b>
                        )
                    })}
                </span>

                {canManage ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={isRescanning}
                        aria-label={intl.formatMessage(messages.recheckLabel, {
                            name: rule.name
                        })}
                        onClick={() => onRescan(rule)}
                    >
                        {isRescanning ? (
                            <Spinner />
                        ) : (
                            <RefreshCw aria-hidden="true" />
                        )}
                        {intl.formatMessage(messages.recheck)}
                    </Button>
                ) : null}
                {canManage ? (
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                    >
                        <Link
                            to={`/workspaces/${workspace.id}/alarms/rules/${rule.id}`}
                            aria-label={intl.formatMessage(messages.editLabel, {
                                name: rule.name
                            })}
                        >
                            <Pencil aria-hidden="true" />
                            {intl.formatMessage(messages.edit)}
                        </Link>
                    </Button>
                ) : null}
            </div>

            <CollapsibleContent>
                <div className="border-t">
                    {findings.isError ? (
                        <Alert variant="destructive" className="m-4 w-auto">
                            <AlertDescription>
                                {intl.formatMessage(messages.error)}
                            </AlertDescription>
                        </Alert>
                    ) : findings.isPending ? (
                        // Named and announced, not two grey bars: without a
                        // `SkeletonRegion` this is the one state here with no
                        // words at all, indistinguishable from "nothing
                        // flagged" to anyone not looking at it.
                        <SkeletonRegion
                            label={intl.formatMessage(messages.loading, {
                                name: rule.name
                            })}
                        >
                            {/* Row for row the shape of `FindingRow` and the
                                footer below, so the height is the final one. */}
                            <div className="divide-y divide-border">
                                {Array.from(
                                    { length: expectedRows },
                                    (_, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 py-2 pl-11 pr-4"
                                        >
                                            <Skeleton className="h-4 flex-1" />
                                            <Skeleton className="h-7 w-14" />
                                        </div>
                                    )
                                )}
                            </div>
                            <div className="flex items-center gap-3 border-t py-2 pl-11 pr-4">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="ml-auto h-7 w-32" />
                            </div>
                        </SkeletonRegion>
                    ) : items.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.gone)}
                        </p>
                    ) : (
                        <>
                            {/* A page turn keeps the previous page on screen
                                (`keepPreviousData`) until the next one lands;
                                it dims after a beat instead of looking
                                current. */}
                            <ul
                                aria-busy={
                                    findings.isPlaceholderData || undefined
                                }
                                className={cn(
                                    'divide-y divide-border',
                                    'transition-opacity duration-(--ds-duration-base) motion-reduce:transition-none',
                                    findings.isPlaceholderData &&
                                        'opacity-60 delay-150'
                                )}
                                aria-label={intl.formatMessage(
                                    messages.listLabel,
                                    { name: rule.name }
                                )}
                            >
                                {items.map((finding) => (
                                    <FindingRow
                                        key={`${finding.ruleId}:${finding.entryId}`}
                                        finding={finding}
                                        typeLabel={typeLabel}
                                    />
                                ))}
                            </ul>
                            <div className="flex flex-wrap items-center gap-3 border-t py-2 pl-11 pr-4">
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {pageCount > 1
                                        ? intl.formatMessage(messages.shown, {
                                              first,
                                              last: first + items.length - 1,
                                              count
                                          })
                                        : intl.formatMessage(
                                              messages.shownAll,
                                              { count }
                                          )}
                                </span>
                                {pageCount > 1 ? (
                                    <FindingsPager
                                        page={page}
                                        pageCount={pageCount}
                                        onPage={setPage}
                                        label={rule.name}
                                    />
                                ) : null}
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto h-7"
                                >
                                    <Link
                                        to={recordsHref}
                                        aria-label={intl.formatMessage(
                                            messages.showAllLabel,
                                            { name: rule.name }
                                        )}
                                    >
                                        {intl.formatMessage(messages.showAll)}
                                    </Link>
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
