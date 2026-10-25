import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    cn,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type { ActivityEvent } from '../../../types/activityEvent';
import { activityDateTime } from '../../activityDateTime';
import { formatActivityWhen } from '../../activityDays';
import { eventWorkspaceId } from '../../activitySubjectLink';
import { ActivityActionTile } from '../ActivityActionTile';
import { ActivitySentence } from '../ActivitySentence';

/** Intl descriptors for {@link ActivityTable}, co-located with the component. */
const messages = defineMessages({
    label: { id: 'activity.table.caption', defaultMessage: 'Activity log' },
    when: { id: 'activity.table.when', defaultMessage: 'When' },
    event: { id: 'activity.table.event', defaultMessage: 'Event' },
    workspace: { id: 'activity.table.workspace', defaultMessage: 'Workspace' },
    none: { id: 'activity.table.none', defaultMessage: '—' }
});

/**
 * The audit log as the app's standard table — **When · Event · Workspace** —
 * with the redesign's sentence ("**Grace** published **Spring launch**") as
 * the Event cell, so the actor needs no column of its own.
 *
 * The sentence is a real `<button>` (`data-activity-row`) that opens the event
 * panel: one tab stop per event, named by what happened. The whole row is
 * also a mouse target — except a click that ends a text selection, because an
 * audit log gets copied from. The open event's row is highlighted
 * (`data-state="selected"`), and `data-activity-row-container` on the `<tr>`
 * lets the non-modal panel treat a click anywhere on another row as "switch",
 * not "close".
 */
export function ActivityTable({
    events,
    workspaceNames,
    selectedId,
    onSelect,
    stale = false
}: {
    events: ActivityEvent[];
    /** Workspace id → name, for the Workspace column. */
    workspaceNames: ReadonlyMap<string, string>;
    /** The event whose panel is open. */
    selectedId: string | null;
    onSelect: (event: ActivityEvent) => void;
    /** The rows are the previous result while the next one loads. */
    stale?: boolean;
}) {
    const intl = useIntl();
    // One "now" per render, so every row agrees on what today is.
    const now = useMemo(() => new Date(), [events]);

    return (
        <Table aria-label={intl.formatMessage(messages.label)} stale={stale}>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col" className="w-40">
                        {intl.formatMessage(messages.when)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.event)}
                    </TableHead>
                    <TableHead scope="col" className="w-48">
                        {intl.formatMessage(messages.workspace)}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {events.map((event) => {
                    const selected = event.id === selectedId;
                    const workspaceId = eventWorkspaceId(event);
                    const workspace = workspaceId
                        ? workspaceNames.get(workspaceId)
                        : undefined;
                    return (
                        <TableRow
                            key={event.id}
                            data-activity-row-container={event.id}
                            data-state={selected ? 'selected' : undefined}
                            className={cn(
                                'cursor-pointer',
                                selected &&
                                    'bg-info-soft/40 hover:bg-info-soft/60'
                            )}
                            onClick={() => {
                                if (window.getSelection()?.toString()) return;
                                onSelect(event);
                            }}
                        >
                            <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                                <time dateTime={activityDateTime(event.at)}>
                                    {formatActivityWhen(intl, event.at, now)}
                                </time>
                            </TableCell>
                            {/* A roomier row than the table default: the log
                                is read line by line, so each event gets air
                                and a tile big enough to scan by. */}
                            <TableCell className="py-3.5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <ActivityActionTile
                                        kind={event.kind}
                                        className="size-8 rounded-lg [&>svg]:size-4"
                                    />
                                    <button
                                        type="button"
                                        data-activity-row={event.id}
                                        aria-haspopup="dialog"
                                        aria-expanded={selected}
                                        onClick={(click) => {
                                            // The row handles the open; stop
                                            // the bubble so it happens once.
                                            click.stopPropagation();
                                            onSelect(event);
                                        }}
                                        className="min-w-0 rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <ActivitySentence event={event} />
                                    </button>
                                </div>
                            </TableCell>
                            <TableCell className="py-3.5 text-sm text-muted-foreground">
                                {workspace ?? intl.formatMessage(messages.none)}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
