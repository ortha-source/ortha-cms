import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
    cn,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@ortha-cms/design-system';
import { ActivityActionCell } from '../ActivityActionCell';
import { ActivityActorCell } from '../ActivityActorCell';
import { ActivitySubjectCell } from '../ActivitySubjectCell';
import { formatActivityDetails } from '../../utils/activityMessages';
import type { ActivityEvent } from '../../types/activityEvent';

/** Intl descriptors for {@link ActivityTable}, co-located with the component. */
const messages = defineMessages({
    when: { id: 'activity.table.when', defaultMessage: 'When' },
    actor: { id: 'activity.table.actor', defaultMessage: 'Actor' },
    action: { id: 'activity.table.action', defaultMessage: 'Action' },
    subject: { id: 'activity.table.subject', defaultMessage: 'Subject' },
    caption: { id: 'activity.table.caption', defaultMessage: 'Activity log' },
    expand: {
        id: 'activity.table.expand',
        defaultMessage: 'Show details'
    },
    collapse: {
        id: 'activity.table.collapse',
        defaultMessage: 'Hide details'
    },
    detailSummary: {
        id: 'activity.table.detail.summary',
        defaultMessage: 'Details'
    },
    detailSubject: {
        id: 'activity.table.detail.subject',
        defaultMessage: 'Subject'
    },
    detailActor: {
        id: 'activity.table.detail.actor',
        defaultMessage: 'Actor'
    },
    detailTime: { id: 'activity.table.detail.time', defaultMessage: 'Time' },
    detailMeta: {
        id: 'activity.table.detail.meta',
        defaultMessage: 'Metadata'
    },
    system: { id: 'activity.table.detail.system', defaultMessage: 'System' }
});

/** Total column count (expand toggle + 4 data columns) for the detail colSpan. */
const COLUMN_COUNT = 5;

/**
 * The audit-log table: when an action happened, who did it, what it was, and
 * the subject it targeted. Each row expands (with a small animation) to a
 * details panel — the full subject, actor, exact time, and raw metadata. The
 * log is read-only; the only row interaction is expand/collapse.
 */
export function ActivityTable({ events }: { events: ActivityEvent[] }) {
    const intl = useIntl();
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(
        () => new Set()
    );

    const toggle = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });

    return (
        <div className="rounded-xl border">
            <Table aria-label={intl.formatMessage(messages.caption)}>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-8" />
                        <TableHead scope="col">
                            {intl.formatMessage(messages.when)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.actor)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.action)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.subject)}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => {
                        const open = expanded.has(event.id);
                        const panelId = `activity-detail-${event.id}`;
                        return (
                            <ActivityRow
                                key={event.id}
                                event={event}
                                open={open}
                                panelId={panelId}
                                onToggle={() => toggle(event.id)}
                            />
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function ActivityRow({
    event,
    open,
    panelId,
    onToggle
}: {
    event: ActivityEvent;
    open: boolean;
    panelId: string;
    onToggle: () => void;
}) {
    const intl = useIntl();
    const details = formatActivityDetails(intl, event);

    return (
        <>
            <TableRow
                onClick={onToggle}
                className="cursor-pointer"
            >
                <TableCell>
                    <button
                        type="button"
                        // The row already toggles on click; stop the bubble so
                        // the button doesn't toggle twice. It stays the
                        // keyboard-accessible control (aria-expanded).
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggle();
                        }}
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={intl.formatMessage(
                            open ? messages.collapse : messages.expand
                        )}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <ChevronRight
                            className={cn(
                                'size-4 transition-transform duration-200 motion-reduce:transition-none',
                                open && 'rotate-90'
                            )}
                        />
                    </button>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {intl.formatDate(event.at, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })}
                </TableCell>
                <TableCell>
                    <ActivityActorCell actor={event.actor} />
                </TableCell>
                <TableCell>
                    <ActivityActionCell kind={event.kind} />
                </TableCell>
                <TableCell>
                    <ActivitySubjectCell event={event} />
                </TableCell>
            </TableRow>
            <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="p-0">
                    <div
                        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                    >
                        <div className="overflow-hidden">
                            <dl
                                id={panelId}
                                inert={open ? undefined : true}
                                className="grid gap-x-6 gap-y-2 border-t bg-muted/30 px-4 py-3 text-sm sm:grid-cols-[auto_1fr]"
                            >
                                {details ? (
                                    <DetailRow
                                        label={intl.formatMessage(
                                            messages.detailSummary
                                        )}
                                        value={details}
                                    />
                                ) : null}
                                <DetailRow
                                    label={intl.formatMessage(
                                        messages.detailSubject
                                    )}
                                    value={`${event.subjectType} · ${event.subjectId}`}
                                    mono
                                />
                                <DetailRow
                                    label={intl.formatMessage(
                                        messages.detailActor
                                    )}
                                    value={
                                        event.actor
                                            ? (event.actor.email ??
                                              event.actor.id)
                                            : intl.formatMessage(messages.system)
                                    }
                                />
                                <DetailRow
                                    label={intl.formatMessage(
                                        messages.detailTime
                                    )}
                                    value={intl.formatDate(event.at, {
                                        dateStyle: 'long',
                                        timeStyle: 'medium'
                                    })}
                                />
                                {event.meta &&
                                Object.keys(event.meta).length > 0 ? (
                                    <DetailRow
                                        label={intl.formatMessage(
                                            messages.detailMeta
                                        )}
                                        value={renderMeta(event.meta)}
                                        mono
                                    />
                                ) : null}
                            </dl>
                        </div>
                    </div>
                </TableCell>
            </TableRow>
        </>
    );
}

/** One label/value pair in the detail panel's definition list. */
function DetailRow({
    label,
    value,
    mono
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <>
            <dt className="font-medium text-muted-foreground">{label}</dt>
            <dd className={cn('min-w-0 break-words', mono && 'font-mono text-xs')}>
                {value}
            </dd>
        </>
    );
}

/** Flattens the open `meta` record to a compact `key: value` string. */
function renderMeta(meta: Record<string, unknown>): string {
    return Object.entries(meta)
        .map(([key, value]) => `${key}: ${formatValue(value)}`)
        .join('  ·  ');
}

/** Renders a single meta value for display. */
function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}
