import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, Copy } from 'lucide-react';
import {
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    toast
} from '@orthacms/design-system';
import type { ActivityEvent } from '../../../types/activityEvent';
import { activityDateTime } from '../../activityDateTime';
import { daysBetween } from '../../activityDays';
import { activityDiff } from '../../activityDiff';
import {
    formatActivityDetails,
    formatActivitySubjectType
} from '../../activityMessages';
import { activityObjectName, actorName } from '../../activitySentence';
import { subjectHref } from '../../activitySubjectLink';
import { ActivityActionTile } from '../ActivityActionTile';
import { ActivityActorAvatar } from '../ActivityActorAvatar';
import { ActivitySentence } from '../ActivitySentence';
import { EventDiffTable } from './EventDiffTable';

/** Intl descriptors for {@link ActivityEventSheet}, co-located. */
const messages = defineMessages({
    title: { id: 'activity.event.title', defaultMessage: 'Event' },
    close: { id: 'activity.event.close', defaultMessage: 'Close' },
    today: { id: 'activity.event.today', defaultMessage: 'Today, {time}' },
    yesterday: {
        id: 'activity.event.yesterday',
        defaultMessage: 'Yesterday, {time}'
    },
    origin: { id: 'activity.event.origin', defaultMessage: 'from {origin}' },
    place: { id: 'activity.event.place', defaultMessage: 'in {workspace}' },
    actor: { id: 'activity.event.actor', defaultMessage: 'Actor' },
    subject: { id: 'activity.event.subject', defaultMessage: 'Subject' },
    kind: { id: 'activity.event.kind', defaultMessage: 'Kind' },
    eventId: { id: 'activity.event.eventId', defaultMessage: 'Event ID' },
    details: { id: 'activity.event.details', defaultMessage: 'Details' },
    copyId: { id: 'activity.event.copyId', defaultMessage: 'Copy event ID' },
    copied: { id: 'activity.event.copied', defaultMessage: 'Event ID copied.' },
    copyFailed: {
        id: 'activity.event.copyFailed',
        defaultMessage: 'Couldn’t copy the event ID.'
    },
    rawMeta: { id: 'activity.event.rawMeta', defaultMessage: 'Raw metadata' },
    noMeta: {
        id: 'activity.event.noMeta',
        defaultMessage: 'This event recorded no metadata.'
    },
    open: { id: 'activity.event.open', defaultMessage: 'Open {name}' },
    moreBy: { id: 'activity.event.moreBy', defaultMessage: 'More by {name}' }
});

/** A long id, shortened for display; the full value stays in `title`. */
function shortId(id: string): string {
    return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/** One fact in the panel's two-column list. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 flex min-w-0 items-center gap-1.5 text-sm">
                {children}
            </dd>
        </div>
    );
}

/**
 * The event panel: what one row of the log says in full — the sentence, the
 * exact time (and where a sign-in came from), **what changed** as a
 * before/after table when the event recorded a transition, the actor, the
 * subject as a link when the admin has a page for it, the kind and the event
 * id, and the raw metadata folded away.
 *
 * A **non-modal** sheet on the right, so the feed stays readable and
 * clickable beside it: clicking another row switches the panel to that event
 * (rows are marked `data-activity-row`), clicking anywhere else or Escape
 * closes it. On close, focus goes back to the row that opened it — unless the
 * reader closed it by clicking somewhere else, which is where focus already
 * is (Radix's own rule for a non-modal dialog's trigger).
 */
export function ActivityEventSheet({
    event,
    workspaceName,
    onClose,
    onMoreBy
}: {
    /** The event to show, or `null` when the panel is closed. */
    event: ActivityEvent | null;
    /** The event's workspace, by name, when it has one we know. */
    workspaceName?: string;
    onClose: () => void;
    /** Narrows the log to the actor's own events. */
    onMoreBy: (event: ActivityEvent) => void;
}) {
    const intl = useIntl();
    const interactedOutside = useRef(false);
    // The row to hand focus back to, captured while the panel is open.
    const openerId = useRef<string | null>(null);
    if (event) openerId.current = event.id;

    const copyId = async (id: string) => {
        try {
            await navigator.clipboard.writeText(id);
            toast.success(intl.formatMessage(messages.copied));
        } catch {
            toast.error(intl.formatMessage(messages.copyFailed));
        }
    };

    const when = (at: Date) => {
        const time = intl.formatTime(at, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const days = daysBetween(at, new Date());
        if (days === 0) return intl.formatMessage(messages.today, { time });
        if (days === 1) return intl.formatMessage(messages.yesterday, { time });
        return intl.formatDate(at, {
            dateStyle: 'medium',
            timeStyle: 'medium'
        });
    };

    return (
        <Sheet
            open={event !== null}
            modal={false}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
                closeLabel={intl.formatMessage(messages.close)}
                // No `SheetDescription`: the sentence under the title is the
                // description, and an empty one would be announced as nothing.
                aria-describedby={
                    event ? `activity-event-${event.id}` : undefined
                }
                onOpenAutoFocus={() => {
                    interactedOutside.current = false;
                }}
                onInteractOutside={(outside) => {
                    const target = outside.target as Element | null;
                    if (target?.closest?.('[data-activity-row]')) {
                        // Another row: it switches the panel, not closes it.
                        outside.preventDefault();
                        return;
                    }
                    interactedOutside.current = true;
                }}
                onCloseAutoFocus={(close) => {
                    close.preventDefault();
                    if (interactedOutside.current || !openerId.current) {
                        return;
                    }
                    document
                        .querySelector<HTMLElement>(
                            `[data-activity-row="${CSS.escape(openerId.current)}"]`
                        )
                        ?.focus();
                }}
            >
                <SheetHeader className="border-b px-4 py-3 text-left">
                    <SheetTitle className="text-sm font-semibold">
                        {intl.formatMessage(messages.title)}
                    </SheetTitle>
                </SheetHeader>
                {event ? (
                    <EventBody
                        event={event}
                        workspaceName={workspaceName}
                        when={when(event.at)}
                        onCopyId={copyId}
                        onMoreBy={onMoreBy}
                    />
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

/** The panel's content for one event. */
function EventBody({
    event,
    workspaceName,
    when,
    onCopyId,
    onMoreBy
}: {
    event: ActivityEvent;
    workspaceName?: string;
    when: string;
    onCopyId: (id: string) => void;
    onMoreBy: (event: ActivityEvent) => void;
}) {
    const intl = useIntl();
    const diff = activityDiff(event);
    const details = diff.length === 0 ? formatActivityDetails(intl, event) : '';
    const origin = event.meta?.['ipAddress'];
    const href = subjectHref(event);
    const subjectName = activityObjectName(event);
    const actor = actorName(intl, event);
    const hasMeta = !!event.meta && Object.keys(event.meta).length > 0;

    return (
        <div className="flex flex-col gap-5 px-4 py-4">
            <div className="flex items-start gap-2.5">
                <ActivityActionTile kind={event.kind} className="mt-0.5" />
                <div className="min-w-0">
                    <p
                        id={`activity-event-${event.id}`}
                        className="text-sm font-medium leading-5"
                    >
                        <ActivitySentence event={event} />
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        <time dateTime={activityDateTime(event.at)}>
                            {when}
                        </time>
                        {workspaceName ? (
                            <>
                                {' · '}
                                {intl.formatMessage(messages.place, {
                                    workspace: workspaceName
                                })}
                            </>
                        ) : null}
                        {typeof origin === 'string' && origin !== '' ? (
                            <>
                                {' · '}
                                {intl.formatMessage(messages.origin, {
                                    origin
                                })}
                            </>
                        ) : null}
                    </p>
                </div>
            </div>

            {diff.length > 0 ? <EventDiffTable rows={diff} /> : null}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Fact label={intl.formatMessage(messages.actor)}>
                    <ActivityActorAvatar
                        actor={event.actor}
                        className="size-[18px]"
                    />
                    <span className="truncate">{actor}</span>
                </Fact>
                <Fact label={intl.formatMessage(messages.subject)}>
                    {href ? (
                        <Link
                            to={href}
                            className="truncate underline underline-offset-2 hover:text-foreground/80"
                        >
                            {subjectName ?? event.subjectId}
                        </Link>
                    ) : (
                        <span className="truncate" title={event.subjectId}>
                            {subjectName ?? event.subjectId}
                        </span>
                    )}
                </Fact>
                <Fact label={intl.formatMessage(messages.kind)}>
                    <span className="truncate font-mono text-xs">
                        {event.kind}
                    </span>
                </Fact>
                <Fact label={intl.formatMessage(messages.eventId)}>
                    <span
                        className="truncate font-mono text-xs"
                        title={event.id}
                    >
                        {shortId(event.id)}
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-muted-foreground"
                        aria-label={intl.formatMessage(messages.copyId)}
                        onClick={() => onCopyId(event.id)}
                    >
                        <Copy aria-hidden className="size-3.5" />
                    </Button>
                </Fact>
                {details ? (
                    <div className="col-span-2 min-w-0">
                        <dt className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.details)}
                        </dt>
                        <dd className="mt-1 break-words text-sm">{details}</dd>
                    </div>
                ) : null}
            </dl>

            <Collapsible className="rounded-lg border">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <ChevronRight
                        aria-hidden
                        className="size-4 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
                    />
                    {intl.formatMessage(messages.rawMeta)}
                </CollapsibleTrigger>
                <CollapsibleContent>
                    {hasMeta ? (
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t px-3 py-2.5 font-mono text-xs">
                            {JSON.stringify(event.meta, null, 2)}
                        </pre>
                    ) : (
                        <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">
                            {intl.formatMessage(messages.noMeta)}
                        </p>
                    )}
                </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap gap-2">
                {href ? (
                    <Button asChild variant="outline" className="shadow-none">
                        <Link to={href}>
                            {intl.formatMessage(messages.open, {
                                // The record's name, else what kind of thing
                                // it is ("Open User") — never a bare id.
                                name:
                                    subjectName ??
                                    formatActivitySubjectType(
                                        intl,
                                        event.subjectType
                                    )
                            })}
                        </Link>
                    </Button>
                ) : null}
                {event.actor ? (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onMoreBy(event)}
                    >
                        {intl.formatMessage(messages.moreBy, { name: actor })}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
