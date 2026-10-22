import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn
} from '@orthacms/design-system';
import type {
    EntryStatusItem,
    EntryStatusSeverity
} from '../../../../../slots/contentSlots';
import {
    arrangeStatusChips,
    sortStatusItems
} from '../../../../../../domain/statusChips';
import { FIELD_ISSUE_PREFIX } from '../../../../../../domain/constants';

const messages = defineMessages({
    issues: {
        id: 'content.status.issues',
        defaultMessage: '{count, plural, one {# issue} other {# issues}}'
    },
    more: { id: 'content.status.more', defaultMessage: '+{count}' },
    name: {
        id: 'content.status.name',
        defaultMessage: 'Status: {summary}'
    },
    blocking: {
        id: 'content.status.blocking',
        defaultMessage: 'Blocks publishing'
    },
    headsUp: { id: 'content.status.headsUp', defaultMessage: 'Heads-up' },
    goTo: { id: 'content.status.goTo', defaultMessage: 'Go to field' }
});

/** A chip's tint by severity: destructive, warning, then neutral. */
const CHIP_VARIANT: Record<
    EntryStatusSeverity,
    'destructive-soft' | 'warning' | 'secondary'
> = {
    blocking: 'destructive-soft',
    warning: 'warning',
    info: 'secondary'
};

/** One chip the bar draws: an item, or the folded count of field issues. */
type Chip = { id: string; severity: EntryStatusSeverity; label: string };

/**
 * The header's **status cluster** — everything the record's state has to say
 * beyond the save state: fields that block publishing, a guard's refusal, a
 * plugin's report (`ENTRY_STATUS_ITEM_SLOT`).
 *
 * The rules are `arrangeStatusChips`': at most two chips, most severe first;
 * from the third item on the top chip carries "+N"; info never takes a chip
 * while something blocks. The field issues fold into one "N issues" chip.
 * The whole cluster is one button opening the full list, grouped "Blocks
 * publishing" / "Heads-up", where a field issue jumps to its field.
 *
 * Renders nothing when there is nothing to say — a quiet header is the
 * common case.
 */
export function EntryStatusCluster({
    items,
    onGoToField
}: {
    items: EntryStatusItem[];
    /** Scroll a field into view and focus it. */
    onGoToField?: (name: string) => void;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    if (items.length === 0) return null;

    const fieldIssues = items.filter((item) =>
        item.id.startsWith(FIELD_ISSUE_PREFIX)
    );
    const others = items.filter(
        (item) => !item.id.startsWith(FIELD_ISSUE_PREFIX)
    );
    const sources: Chip[] = [
        ...(fieldIssues.length > 0
            ? [
                  {
                      id: 'issues',
                      severity: 'blocking' as const,
                      label: intl.formatMessage(messages.issues, {
                          count: fieldIssues.length
                      })
                  }
              ]
            : []),
        ...others
    ];
    const { chips, more } = arrangeStatusChips(sources);
    const sorted = sortStatusItems(items);
    const blocking = sorted.filter((item) => item.severity === 'blocking');
    const headsUp = sorted.filter((item) => item.severity !== 'blocking');

    const go = (item: EntryStatusItem) => {
        const target = item.target;
        if (!target) return;
        setOpen(false);
        if ('field' in target) onGoToField?.(target.field);
        else target.onSelect();
    };

    const group = (title: string, list: EntryStatusItem[]) =>
        list.length === 0 ? null : (
            <section className="flex flex-col gap-1">
                <h3 className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                    {title}
                </h3>
                <ul className="flex flex-col">
                    {list.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-md px-2 py-1.5"
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                                    item.severity === 'blocking'
                                        ? 'bg-destructive'
                                        : item.severity === 'warning'
                                          ? 'bg-warning'
                                          : 'bg-muted-foreground'
                                )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="text-sm">{item.label}</span>
                                {item.detail ? (
                                    <span className="text-xs text-muted-foreground">
                                        {item.detail}
                                    </span>
                                ) : null}
                            </div>
                            {item.target ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 shrink-0 px-2"
                                    onClick={() => go(item)}
                                >
                                    {'field' in item.target
                                        ? intl.formatMessage(messages.goTo)
                                        : item.target.label}
                                </Button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </section>
        );

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-testid="entry-status-cluster"
                    aria-label={intl.formatMessage(messages.name, {
                        summary: sources.map((chip) => chip.label).join(', ')
                    })}
                    className="flex shrink-0 items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {chips.map((chip) => (
                        <Badge
                            key={chip.id}
                            variant={CHIP_VARIANT[chip.severity]}
                            className="max-w-48 truncate"
                        >
                            {chip.label}
                        </Badge>
                    ))}
                    {more > 0 ? (
                        <Badge variant="outline" className="tabular-nums">
                            {intl.formatMessage(messages.more, {
                                count: more
                            })}
                        </Badge>
                    ) : null}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="flex w-80 flex-col gap-2 p-2"
                data-testid="entry-status-list"
            >
                {group(intl.formatMessage(messages.blocking), blocking)}
                {group(intl.formatMessage(messages.headsUp), headsUp)}
            </PopoverContent>
        </Popover>
    );
}
