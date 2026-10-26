import { defineMessages, useIntl } from 'react-intl';
import { Activity } from 'lucide-react';
import {
    Button,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@orthacms/design-system';

/** Intl descriptors for {@link ActivityEmpty}, co-located with the component. */
const messages = defineMessages({
    filteredTitle: {
        id: 'activity.empty.filtered.title',
        defaultMessage: 'No activity matches'
    },
    filteredDescription: {
        id: 'activity.empty.filtered.description',
        defaultMessage: 'Try a different action, actor, or date range.'
    },
    clear: {
        id: 'activity.empty.clear',
        defaultMessage: 'Clear filters'
    },
    rangeTitle: {
        id: 'activity.empty.range.title',
        defaultMessage: 'Nothing happened in this period'
    },
    rangeDescription: {
        id: 'activity.empty.range.description',
        defaultMessage:
            'No action was recorded in the time range you chose. Older activity is still in the log.'
    },
    showAll: {
        id: 'activity.empty.showAll',
        defaultMessage: 'Show all time'
    },
    emptyTitle: {
        id: 'activity.empty.none.title',
        defaultMessage: 'No activity yet'
    },
    emptyDescription: {
        id: 'activity.empty.none.description',
        // Deployment-wide, not workspace-scoped: `activity_events` has no
        // workspace column and this page sends no workspace context, so
        // promising a workspace scope here would misstate what the reader is
        // looking at. See the plugin's AGENTS.md.
        defaultMessage:
            'Actions across this deployment will appear here — every workspace, and the actions that belong to none.'
    }
});

/** Why the log is empty, which decides what the state offers. */
export type ActivityEmptyReason = 'filtered' | 'range' | 'none';

/**
 * The empty state under the toolbar, for three different answers:
 * - **filtered** — a search or a filter matched nothing; offers to clear them.
 * - **range** — nothing in the chosen time range, with no other filter; offers
 *   the whole log. The page opens on the last 7 days, so a quiet week must not
 *   read as "no activity yet" on a deployment with years of it.
 * - **none** — the log itself is empty.
 */
export function ActivityEmpty({
    reason,
    onClear,
    onShowAll
}: {
    reason: ActivityEmptyReason;
    /** Clears the search and every filter. */
    onClear: () => void;
    /** Widens the time range to all time. */
    onShowAll: () => void;
}) {
    const intl = useIntl();
    const copy = {
        filtered: [messages.filteredTitle, messages.filteredDescription],
        range: [messages.rangeTitle, messages.rangeDescription],
        none: [messages.emptyTitle, messages.emptyDescription]
    }[reason];

    return (
        <Empty className="border">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Activity />
                </EmptyMedia>
                <EmptyTitle>{intl.formatMessage(copy[0])}</EmptyTitle>
                <EmptyDescription>
                    {intl.formatMessage(copy[1])}
                </EmptyDescription>
            </EmptyHeader>
            {reason === 'none' ? null : (
                <EmptyContent>
                    <Button
                        variant="outline"
                        className="shadow-none"
                        onClick={reason === 'filtered' ? onClear : onShowAll}
                    >
                        {intl.formatMessage(
                            reason === 'filtered'
                                ? messages.clear
                                : messages.showAll
                        )}
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
}
