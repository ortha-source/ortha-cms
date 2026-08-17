import { useIntl } from 'react-intl';
import { formatActivitySubjectType } from '../../../activityMessages';
import type { ActivityEvent } from '../../../../types/activityEvent';

/**
 * The "Subject" cell: the entity an action targeted — its localized type name
 * over a monospaced, truncated id. The id is `text` and not always a uuid, so
 * it's shown verbatim with a `title` carrying the full value; the expanded row's
 * Subject line is the keyboard-reachable escape hatch for it.
 *
 * The type goes through {@link formatActivitySubjectType} rather than a CSS
 * `capitalize`: the wire values are snake_cased machine tokens, so `capitalize`
 * rendered `media_asset` as "Media_asset" and `content_entry` as "Content_entry"
 * — and left them untranslatable.
 */
export function ActivitySubjectCell({ event }: { event: ActivityEvent }) {
    const intl = useIntl();

    return (
        <div className="min-w-0">
            <p className="text-sm">
                {formatActivitySubjectType(intl, event.subjectType)}
            </p>
            <p
                className="truncate font-mono text-xs text-muted-foreground"
                title={event.subjectId}
            >
                {event.subjectId}
            </p>
        </div>
    );
}
