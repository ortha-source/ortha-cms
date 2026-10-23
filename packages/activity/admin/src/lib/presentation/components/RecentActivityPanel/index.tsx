import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@orthacms/identity-admin';
import { Skeleton } from '@orthacms/design-system';
import { initialsFromEmail } from '@orthacms/utils-admin';
import { useActivityLog } from '../../../application/useActivityLog';
import { activityDateTime } from '../../activityDateTime';
import { formatActivityAction } from '../../activityMessages';

/** Intl descriptors for {@link RecentActivityPanel}, co-located here. */
const messages = defineMessages({
    title: {
        id: 'activity.home.title',
        defaultMessage: 'Recent activity'
    },
    viewAll: {
        id: 'activity.home.viewAll',
        defaultMessage: 'View all'
    },
    system: {
        id: 'activity.home.system',
        defaultMessage: 'System'
    },
    empty: {
        id: 'activity.home.empty',
        defaultMessage: 'No activity yet.'
    },
    error: {
        id: 'activity.home.error',
        defaultMessage: 'Couldn’t load activity.'
    },
    today: { id: 'activity.home.today', defaultMessage: 'Today' },
    yesterday: { id: 'activity.home.yesterday', defaultMessage: 'Yesterday' }
});

/** Calendar days between two instants, in the reader's own timezone. */
function daysBetween(at: Date, now: Date): number {
    const day = (d: Date) =>
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
    return day(now) - day(at);
}

/** Permission gating the activity feed (mirrors the Activity page + nav item). */
const ACTIVITY_READ = 'activity:read';

/** How many recent events the home panel shows. */
const PREVIEW_SIZE = 6;

/**
 * The home dashboard's Recent activity panel: the latest audit events (actor +
 * the localized action label + time) with a "View all" link to the Activity log.
 * Backed by the real `GET /api/activity`. Renders nothing when the user lacks
 * `activity:read`, so a viewer without audit access never sees an empty panel.
 */
export function RecentActivityPanel() {
    const intl = useIntl();
    const canRead = useHasPermission(ACTIVITY_READ);
    const { data, isPending, isError } = useActivityLog(
        { page: 1, pageSize: PREVIEW_SIZE },
        canRead
    );

    if (!canRead) {
        return null;
    }

    const events = data?.items ?? [];
    const now = new Date();
    const dayLabel = (at: Date) => {
        const days = daysBetween(at, now);
        if (days === 0) return intl.formatMessage(messages.today);
        if (days === 1) return intl.formatMessage(messages.yesterday);
        return intl.formatDate(at, { month: 'short', day: 'numeric' });
    };
    // Grouped by calendar day, newest first — the list arrives sorted, so a
    // new group starts wherever the label changes.
    const groups: { label: string; events: typeof events }[] = [];
    const newestFirst = [...events].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
    for (const event of newestFirst) {
        const label = dayLabel(new Date(event.at));
        const last = groups[groups.length - 1];
        if (last?.label === label) last.events.push(event);
        else groups.push({ label, events: [event] });
    }

    return (
        <section
            aria-labelledby="home-activity"
            className="flex flex-col rounded-xl border bg-card pb-2"
        >
            <div className="flex items-baseline gap-2 px-4 pt-3.5">
                <h2
                    id="home-activity"
                    className="text-[15px] font-semibold leading-5"
                >
                    {intl.formatMessage(messages.title)}
                </h2>
                <Link
                    to="/activity"
                    className="ml-auto text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                    {intl.formatMessage(messages.viewAll)}
                </Link>
            </div>
            {isPending ? (
                <div className="flex flex-col gap-3 px-4 pt-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <Skeleton className="size-5 rounded-full" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <p
                    role="alert"
                    className="px-4 py-6 text-center text-sm text-destructive"
                >
                    {intl.formatMessage(messages.error)}
                </p>
            ) : events.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : (
                groups.map((group) => (
                    <div key={group.label}>
                        <h3 className="px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                            {group.label}
                        </h3>
                        <ul>
                            {group.events.map((event) => {
                                const actor =
                                    event.actor?.email ??
                                    intl.formatMessage(messages.system);
                                return (
                                    <li
                                        key={event.id}
                                        className="flex items-center gap-3 px-4 py-2 text-[13px] leading-[18px]"
                                    >
                                        <span
                                            aria-hidden
                                            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground"
                                        >
                                            {event.actor?.email
                                                ? initialsFromEmail(
                                                      event.actor.email
                                                  )
                                                : 'S'}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">
                                            <span className="font-medium">
                                                {actor}
                                            </span>{' '}
                                            {/* The localized action label,
                                                the same one the Activity
                                                table's Action column shows. */}
                                            <span className="text-muted-foreground">
                                                {formatActivityAction(
                                                    intl,
                                                    event.kind
                                                )}
                                            </span>
                                        </span>
                                        <time
                                            className="shrink-0 text-xs tabular-nums text-muted-foreground"
                                            dateTime={activityDateTime(
                                                event.at
                                            )}
                                        >
                                            {intl.formatTime(event.at, {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </time>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))
            )}
        </section>
    );
}
