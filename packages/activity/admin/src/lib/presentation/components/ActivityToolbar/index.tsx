import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { SearchToolbar } from '@ortha-cms/design-system';

/** Intl descriptors for {@link ActivityToolbar}, co-located. */
const messages = defineMessages({
    searchLabel: {
        id: 'activity.toolbar.searchLabel',
        defaultMessage: 'Search by actor email'
    },
    searchPlaceholder: {
        id: 'activity.toolbar.searchPlaceholder',
        defaultMessage: 'Search by actor email'
    }
});

type ActivityToolbarProps = {
    /** Actor-email search box value. */
    email: string;
    onEmailChange: (value: string) => void;
    /** Optional advanced-filter control rendered on the right. */
    filterControl?: ReactNode;
};

/**
 * The Activity Log toolbar: an actor-email search box with the advanced-filter
 * control pinned to the right. Layout lives in the shared `SearchToolbar`; this
 * wrapper only supplies the localised strings and the page-owned filter control.
 */
export function ActivityToolbar({
    email,
    onEmailChange,
    filterControl
}: ActivityToolbarProps) {
    const intl = useIntl();

    return (
        <SearchToolbar
            value={email}
            onValueChange={onEmailChange}
            searchLabel={intl.formatMessage(messages.searchLabel)}
            searchPlaceholder={intl.formatMessage(messages.searchPlaceholder)}
            actions={filterControl}
        />
    );
}
