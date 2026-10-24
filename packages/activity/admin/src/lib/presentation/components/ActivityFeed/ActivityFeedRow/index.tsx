import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { ActivityEvent } from '../../../../types/activityEvent';
import { activityDateTime } from '../../../activityDateTime';
import { eventWorkspaceId } from '../../../activitySubjectLink';
import { ActivityActionTile } from '../../ActivityActionTile';
import { ActivityActorAvatar } from '../../ActivityActorAvatar';
import { ActivitySentence } from '../../ActivitySentence';

/** Intl descriptors for {@link ActivityFeedRow}, co-located. */
const messages = defineMessages({
    place: { id: 'activity.feed.place', defaultMessage: 'in {workspace}' }
});

/**
 * One event in the feed: its action tile, the actor's avatar, the sentence,
 * the workspace it happened in, and the time.
 *
 * The whole row is one `<button>` that opens the event panel — its text is the
 * sentence, so that is its accessible name, and Enter/Space open it with no
 * extra wiring. `aria-expanded` says whether the panel is showing this event.
 * `data-activity-row` lets the panel tell a click on another row (switch to
 * it) from a click anywhere else (close).
 */
export function ActivityFeedRow({
    event,
    workspaceNames,
    selected,
    onSelect
}: {
    event: ActivityEvent;
    workspaceNames: ReadonlyMap<string, string>;
    selected: boolean;
    onSelect: (event: ActivityEvent) => void;
}) {
    const intl = useIntl();
    const workspaceId = eventWorkspaceId(event);
    const workspace = workspaceId ? workspaceNames.get(workspaceId) : undefined;

    return (
        <li>
            <button
                type="button"
                data-activity-row={event.id}
                aria-haspopup="dialog"
                aria-expanded={selected}
                onClick={() => {
                    // An audit log gets copied from: a click that ends a text
                    // selection is a selection, not a request for the panel.
                    if (window.getSelection()?.toString()) return;
                    onSelect(event);
                }}
                className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
                    selected && 'bg-info-soft/40 hover:bg-info-soft/60'
                )}
            >
                <ActivityActionTile kind={event.kind} />
                <ActivityActorAvatar actor={event.actor} />
                <span className="min-w-0 flex-1 truncate">
                    <ActivitySentence event={event} />
                    {workspace ? (
                        <span className="text-muted-foreground">
                            {' '}
                            {intl.formatMessage(messages.place, { workspace })}
                        </span>
                    ) : null}
                </span>
                <time
                    dateTime={activityDateTime(event.at)}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                    {intl.formatTime(event.at, {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </time>
            </button>
        </li>
    );
}
