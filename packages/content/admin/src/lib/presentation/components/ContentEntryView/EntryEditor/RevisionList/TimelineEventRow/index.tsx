import { useIntl } from 'react-intl';
import type { EntryTimelineEvent } from '../../../../../slots/contentSlots';

/**
 * One contributed row in the History timeline — something that was **done**
 * to the record (published, unpublished, audiences changed) rather than a
 * version of it. Lighter than a version row on purpose: a small dot where a
 * version has its number, muted text, no actions — the eye runs down the
 * versions first.
 */
export function TimelineEventRow({ event }: { event: EntryTimelineEvent }) {
    const intl = useIntl();
    const at = new Date(event.at);
    const valid = !Number.isNaN(at.getTime());
    return (
        <div
            data-testid="timeline-event"
            className="flex gap-3 rounded-lg px-2.5 py-2 text-[13px] leading-[18px] text-muted-foreground"
        >
            <span className="flex w-[22px] shrink-0 justify-center">
                <span
                    aria-hidden
                    className="mt-[5px] size-2 rounded-full bg-border"
                />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span>
                    <span className="text-foreground/80">{event.title}</span>
                    {event.actor ? (
                        <>
                            {' · '}
                            <span>{event.actor}</span>
                        </>
                    ) : null}
                </span>
                {valid ? (
                    <time dateTime={at.toISOString()} className="text-xs">
                        {intl.formatTime(at, {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </time>
                ) : null}
            </span>
        </div>
    );
}
