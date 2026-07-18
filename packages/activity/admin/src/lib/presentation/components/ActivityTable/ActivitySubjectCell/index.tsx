import type { ActivityEvent } from '../../../../types/activityEvent';

/**
 * The "Subject" cell: the entity an action targeted — its type (e.g. `user`)
 * over a monospaced, truncated id. The id is `text` and not always a uuid, so
 * it's shown verbatim with a tooltip-friendly `title` for the full value.
 */
export function ActivitySubjectCell({ event }: { event: ActivityEvent }) {
    return (
        <div className="min-w-0">
            <p className="text-sm capitalize">{event.subjectType}</p>
            <p
                className="truncate font-mono text-xs text-muted-foreground"
                title={event.subjectId}
            >
                {event.subjectId}
            </p>
        </div>
    );
}
