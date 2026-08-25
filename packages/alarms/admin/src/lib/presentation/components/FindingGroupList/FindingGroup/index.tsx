import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Skeleton
} from '@orthacms/design-system';
import { ChevronRight } from 'lucide-react';
import { useAlarmFindings } from '../../../../application/useAlarmFindings';
import type { AlarmRule } from '../../../../types/alarm';
import { severityLook } from '../../../severityLook';
import { FindingRow } from '../../FindingRow';
import { FindingsPager } from '../../FindingsPager';

const messages = defineMessages({
    count: {
        id: 'alarms.group.count',
        defaultMessage: '{count, plural, one {# record} other {# records}}'
    },
    toggle: {
        id: 'alarms.group.toggle',
        defaultMessage:
            '{name} — {count, plural, one {# record} other {# records}}'
    },
    listLabel: {
        id: 'alarms.group.listLabel',
        defaultMessage: 'Records flagged by {name}'
    },
    error: {
        id: 'alarms.group.error',
        defaultMessage:
            'These records could not be loaded, so this is not a statement that the list is empty.'
    },
    gone: {
        id: 'alarms.group.gone',
        defaultMessage: 'Nothing here any more — these records were fixed.'
    }
});

/** Findings shown per page inside one group. */
const GROUP_PAGE_SIZE = 10;

/** Props for {@link FindingGroup}. */
export type FindingGroupProps = {
    /** The alarm this group is about. */
    rule: AlarmRule;
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
};

/**
 * One alarm and the records it has flagged, collapsed by default.
 *
 * **Why grouping rather than a flat list.** A workspace with a thousand flagged
 * records gave forty pages of rows in which nothing said which alarm was
 * responsible, and every row repeated the same sentence. What a person actually
 * does with findings is one alarm at a time — "fourteen articles link to a
 * draft author" is one pass, while fourteen rows about fourteen articles is
 * fourteen context switches. The page claimed to group by rule in its own
 * documentation and never did; this is that claim implemented.
 *
 * **The records load when the group is opened**, not on mount. A workspace with
 * twenty alarms would otherwise fire twenty list requests to draw a screen on
 * which nineteen of them are collapsed.
 *
 * **Each group pages on its own**, ten at a time. A group is a work queue you
 * go down, and a shared pager would make "page 3" mean nothing in particular.
 */
export function FindingGroup({ rule, count, defaultOpen }: FindingGroupProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(defaultOpen);
    const [page, setPage] = useState(1);
    const { Icon, ink, label } = severityLook(rule.severity);

    const findings = useAlarmFindings(
        { state: 'open', ruleId: rule.id, page, pageSize: GROUP_PAGE_SIZE },
        open
    );

    const pageCount = useMemo(
        () => Math.max(1, Math.ceil(count / GROUP_PAGE_SIZE)),
        [count]
    );

    // Muting the last row of a trailing page leaves this group's page past the
    // end, and the refetch lands on an empty list with the pager hidden — the
    // same stranding the flat list had, once per group.
    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    const items = findings.data?.items ?? [];

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="rounded-xl border bg-card"
        >
            <CollapsibleTrigger
                className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
                aria-label={intl.formatMessage(messages.toggle, {
                    name: rule.name,
                    count
                })}
            >
                <ChevronRight
                    aria-hidden="true"
                    className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none ${
                        open ? 'rotate-90' : ''
                    }`}
                />
                <Icon aria-hidden="true" className={`size-4 shrink-0 ${ink}`} />
                {/* The severity in words, for anyone the glyph and its colour
                    do not reach. */}
                <span className="sr-only">{intl.formatMessage(label)}</span>

                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                        {rule.name}
                    </span>
                    {/* What an editor reads on the record itself. It is
                        constant across this group, which is exactly why it
                        belongs on the header and not on every row. */}
                    <span className="truncate text-xs text-muted-foreground">
                        {rule.findingTitle}
                    </span>
                </span>

                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {intl.formatMessage(messages.count, { count })}
                </span>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="border-t">
                    {findings.isError ? (
                        <Alert variant="destructive" className="m-4 w-auto">
                            <AlertDescription>
                                {intl.formatMessage(messages.error)}
                            </AlertDescription>
                        </Alert>
                    ) : findings.isPending ? (
                        <div className="flex flex-col gap-2 p-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.gone)}
                        </p>
                    ) : (
                        <>
                            <ul
                                className="divide-y divide-border"
                                aria-label={intl.formatMessage(
                                    messages.listLabel,
                                    { name: rule.name }
                                )}
                            >
                                {items.map((finding) => (
                                    <FindingRow
                                        key={`${finding.ruleId}:${finding.entryId}`}
                                        finding={finding}
                                    />
                                ))}
                            </ul>
                            {/* The wrapper is conditional, not just its
                                contents. `FindingsPager` renders nothing at one
                                page, but a padded box around nothing is still a
                                padded box — it left ~28px of dead space under
                                the last row of every group small enough not to
                                need paging, which is most of them. */}
                            {pageCount > 1 ? (
                                <div className="px-4 pb-4 pt-3">
                                    <FindingsPager
                                        page={page}
                                        pageCount={pageCount}
                                        onPage={setPage}
                                        label={rule.name}
                                    />
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
