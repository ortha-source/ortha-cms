import { useIntl } from 'react-intl';
import type { EntryTimelineEvent } from '../../../../../slots/contentSlots';

/**
 * One contributed row in the History timeline — something that was **done**
 * to the record (published, unpublished, audiences changed) rather than a
 * version of it. Lighter than a version row on purpose: it carries no
 * actions, and the eye should run down the versions first.
 */
export function TimelineEventRow({ event }: { event: EntryTimelineEvent }) {
    const intl = useIntl();
    const at = new Date(event.at);
    const valid = !Number.isNaN(at.getTime());
    return (
        <div
            data-testid="timeline-event"
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 pl-3 text-muted-foreground"
        >
            <div className="flex min-w-0 items-baseline gap-2">
                <span
                    aria-hidden
                    className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-border"
                />
                <span className="text-sm text-foreground">{event.title}</span>
                {event.actor ? (
                    <span className="truncate text-xs">{event.actor}</span>
                ) : null}
            </div>
            {valid ? (
                <time
                    dateTime={at.toISOString()}
                    className="shrink-0 text-xs tabular-nums"
                >
                    {intl.formatTime(at, {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </time>
            ) : null}
        </div>
    );
}
