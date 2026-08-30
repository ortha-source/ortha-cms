import { defineMessages, useIntl } from 'react-intl';
import { Spinner } from '@orthacms/design-system';
import {
    EntrySidebarSection,
    type EntrySlotContext
} from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useEntryActivity } from '../../../application/useEntryActivity';
import { formatActivityAction } from '../../activityMessages';
import { activityDateTime } from '../../activityDateTime';

/** How many rows the rail shows. Enough to answer "what just happened here". */
const WIDGET_PAGE_SIZE = 6;

/** Intl descriptors for {@link EntryActivityWidget}, co-located here. */
const messages = defineMessages({
    title: { id: 'activity.entryWidget.title', defaultMessage: 'Activity' },
    count: {
        id: 'activity.entryWidget.count',
        defaultMessage:
            '{total, plural, =0 {Nothing recorded yet} one {# recorded action} other {# recorded actions}}'
    },
    empty: {
        id: 'activity.entryWidget.empty',
        defaultMessage: 'Nothing has been recorded for this record yet.'
    },
    failed: {
        id: 'activity.entryWidget.failed',
        defaultMessage:
            'The history could not be loaded, so this is not a record of nothing having happened.'
    },
    system: {
        id: 'activity.entryWidget.system',
        defaultMessage: 'System'
    }
});

/**
 * The entry editor's **Activity** block — who did what to the record that is
 * open.
 *
 * The editor already had a History tab, and it shows something else: the
 * revision timeline, which records what the words were at each save. It cannot
 * answer who published the entry, who took it down, who deleted and restored
 * it, or who changed which audiences may read it — none of those are snapshots
 * of a document, and until now none of them were reachable from the editor at
 * all. The deployment-wide Activity page has them, and is `activity:read`,
 * admin-only — so the person most likely to ask was the one person who could
 * not.
 *
 * This reads the entry-scoped route instead, gated on `content:read`: every row
 * it can return is about a record the reader may already open, so it needs no
 * authority beyond having opened it.
 *
 * Rendered into `ENTRY_SIDEBAR_WIDGET_SLOT`, so `content-admin` needs no
 * knowledge of the audit log. It draws no chrome of its own — the rail is one
 * flat panel and `EntrySidebarSection` is exported for exactly this.
 */
export function EntryActivityWidget({ entry, isCreate }: EntrySlotContext) {
    const intl = useIntl();
    const canRead = useHasPermission('content:read');

    // A record being created has no id yet, so there is no history to have and
    // no request worth making.
    const entryId = !isCreate ? entry?.id : undefined;
    const { data, isPending, isError } = useEntryActivity(
        entryId,
        WIDGET_PAGE_SIZE,
        canRead
    );

    if (!canRead || !entryId) return null;

    return (
        <EntrySidebarSection
            title={intl.formatMessage(messages.title)}
            description={
                isPending || isError
                    ? undefined
                    : intl.formatMessage(messages.count, {
                          total: data?.total ?? 0
                      })
            }
        >
            {isPending ? <Spinner /> : null}

            {isError ? (
                // Not the empty state: "nothing happened" and "we could not
                // find out" read identically, and only one of them is a fact.
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.failed)}
                </p>
            ) : null}

            {!isPending && !isError && (data?.items.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : null}

            {data && data.items.length > 0 ? (
                <ul className="flex flex-col gap-3">
                    {data.items.map((event) => (
                        <li key={event.id} className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">
                                {formatActivityAction(intl, event.kind)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {/* The actor's frozen email snapshot — or
                                    "System" for an action nobody performed, and
                                    for a token's write the token's own label. */}
                                {event.actor?.email ??
                                    intl.formatMessage(messages.system)}
                            </span>
                            <time
                                // Through the shared guard, never
                                // `toISOString()` directly: `at` may be an
                                // Invalid Date (the mapper deliberately
                                // invents no fallback instant for an audit
                                // row), and `toISOString` throws on one —
                                // which took the whole SPA down once already.
                                dateTime={activityDateTime(event.at)}
                                className="text-xs text-muted-foreground"
                            >
                                {intl.formatDate(event.at, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </time>
                        </li>
                    ))}
                </ul>
            ) : null}
        </EntrySidebarSection>
    );
}
