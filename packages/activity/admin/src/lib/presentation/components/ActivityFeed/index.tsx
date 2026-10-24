import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { ActivityEvent } from '../../../types/activityEvent';
import { groupByDay, type ActivityDayGroup } from '../../activityDays';
import { ActivityFeedRow } from './ActivityFeedRow';

/** Intl descriptors for {@link ActivityFeed}, co-located with the component. */
const messages = defineMessages({
    label: { id: 'activity.feed.label', defaultMessage: 'Activity log' },
    today: { id: 'activity.feed.today', defaultMessage: 'Today' },
    yesterday: { id: 'activity.feed.yesterday', defaultMessage: 'Yesterday' },
    unknownDay: {
        id: 'activity.feed.unknownDay',
        defaultMessage: 'Unknown date'
    }
});

/**
 * The audit log as **sentences grouped by day** — "Grace Hopper published
 * Spring launch in Marketing site · 10:42" under a "Today" heading — rather than
 * a When · Actor · Action · Subject table. The one place in the admin where a
 * feed replaces a table on purpose: an audit trail is read as a story, and the
 * four columns split one fact into four cells a reader had to reassemble.
 *
 * Each day is an `<h2>` over a `<ul>`; each row is a button that opens the
 * event panel (`ActivityEventSheet`), so a row is one tab stop with the whole
 * sentence as its name. The order is the server's — `groupByDay` only splits
 * runs, it never re-sorts.
 */
export function ActivityFeed({
    events,
    workspaceNames,
    selectedId,
    onSelect,
    stale = false
}: {
    events: ActivityEvent[];
    /** Workspace id → name, for the quiet "in Marketing site" suffix. */
    workspaceNames: ReadonlyMap<string, string>;
    /** The event whose panel is open, highlighted in the list. */
    selectedId: string | null;
    onSelect: (event: ActivityEvent) => void;
    /**
     * The rows are the previous page/filter's result while the next loads
     * (`isPlaceholderData`) — dimmed and `aria-busy`.
     */
    stale?: boolean;
}) {
    const intl = useIntl();
    // One "now" per render, so every heading in it agrees on what today is.
    const groups = useMemo(() => groupByDay(events, new Date()), [events]);

    const heading = (group: ActivityDayGroup<ActivityEvent>) => {
        if (group.key === 'invalid') {
            return intl.formatMessage(messages.unknownDay);
        }
        if (group.kind === 'today') return intl.formatMessage(messages.today);
        if (group.kind === 'yesterday') {
            return intl.formatMessage(messages.yesterday);
        }
        return intl.formatDate(group.date, {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <section
            aria-label={intl.formatMessage(messages.label)}
            aria-busy={stale || undefined}
            className={cn(
                'overflow-hidden rounded-xl border bg-card transition-opacity motion-reduce:transition-none',
                stale && 'opacity-60'
            )}
        >
            {groups.map((group, index) => {
                const headingId = `activity-day-${index}`;
                return (
                    <div key={`${group.key}-${index}`}>
                        <h2
                            id={headingId}
                            className={cn(
                                'bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                                index > 0 && 'border-t'
                            )}
                        >
                            {heading(group)}
                        </h2>
                        <ul aria-labelledby={headingId} className="divide-y">
                            {group.events.map((event) => (
                                <ActivityFeedRow
                                    key={event.id}
                                    event={event}
                                    workspaceNames={workspaceNames}
                                    selected={event.id === selectedId}
                                    onSelect={onSelect}
                                />
                            ))}
                        </ul>
                    </div>
                );
            })}
        </section>
    );
}
