import { defineMessages, useIntl } from 'react-intl';
import type {
    EntrySlotContext,
    EntryTimelineSource
} from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useEntryActivity } from '../../../application/useEntryActivity';
import { formatActivityAction } from '../../activityMessages';

/**
 * How many actions the timeline asks for. The History view is a page, not a
 * corner of a rail: the first question asked of a record's history — "when
 * did this last go live, and who did it?" — is regularly older than a
 * handful of actions on a record being worked on.
 */
const TIMELINE_PAGE_SIZE = 25;

const messages = defineMessages({
    system: { id: 'activity.entryTab.system', defaultMessage: 'System' }
});

/**
 * The open record's activity as rows of the entry editor's **History**
 * timeline (content-admin's `ENTRY_TIMELINE_SLOT`): who published it, took
 * it down, deleted or restored it, changed who may read it — what the
 * version rows cannot say, since none of those is a snapshot of a document.
 *
 * It used to be an Activity tab of its own beside History (`ORT-198` moved it
 * out of the rail); two timelines of one record, side by side, asked the
 * reader to merge them in their head. The retired tab's links land on
 * History filtered to activity.
 *
 * Gated on `content:read`, the key the entry-scoped route is gated on: every
 * row it returns is about a record the reader already has open. Without it
 * this returns `null` and History offers no Activity filter at all. A record
 * being created has no id yet, so nothing to have happened and no request.
 */
export function useEntryActivityTimeline({
    entry,
    isCreate
}: EntrySlotContext): EntryTimelineSource | null {
    const intl = useIntl();
    const canRead = useHasPermission('content:read');
    const entryId = !isCreate ? entry?.id : undefined;
    const { data, isPending, isError } = useEntryActivity(
        entryId,
        TIMELINE_PAGE_SIZE,
        canRead && !!entryId
    );
    if (!canRead || !entryId) return null;
    return {
        isPending,
        isError,
        events: (data?.items ?? []).map((event) => ({
            id: event.id,
            at: event.at,
            title: formatActivityAction(intl, event.kind),
            // The actor's frozen email snapshot — or "System" for an action
            // nobody performed.
            actor: event.actor?.email ?? intl.formatMessage(messages.system)
        }))
    };
}
