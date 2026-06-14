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
} from '@ortha-cms/design-system';

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
    emptyTitle: {
        id: 'activity.empty.none.title',
        defaultMessage: 'No activity yet'
    },
    emptyDescription: {
        id: 'activity.empty.none.description',
        defaultMessage: 'Actions across the workspace will appear here.'
    }
});

/**
 * The empty state under the toolbar. A filtered miss offers to clear the
 * filters; a genuinely empty log explains that activity will appear as actions
 * are taken.
 */
export function ActivityEmpty({
    filtered,
    onClear
}: {
    /** Whether any filter is currently narrowing the log. */
    filtered: boolean;
    /** Clears every filter. */
    onClear: () => void;
}) {
    const intl = useIntl();

    return (
        <Empty className="border">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Activity />
                </EmptyMedia>
                <EmptyTitle>
                    {intl.formatMessage(
                        filtered ? messages.filteredTitle : messages.emptyTitle
                    )}
                </EmptyTitle>
                <EmptyDescription>
                    {intl.formatMessage(
                        filtered
                            ? messages.filteredDescription
                            : messages.emptyDescription
                    )}
                </EmptyDescription>
            </EmptyHeader>
            {filtered ? (
                <EmptyContent>
                    <Button
                        variant="outline"
                        className="shadow-none"
                        onClick={onClear}
                    >
                        {intl.formatMessage(messages.clear)}
                    </Button>
                </EmptyContent>
            ) : null}
        </Empty>
    );
}
