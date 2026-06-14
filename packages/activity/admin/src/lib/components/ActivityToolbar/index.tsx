import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from '@ortha-cms/design-system';

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
    /**
     * Optional advanced-filter control (the query-builder drawer trigger).
     * The page owns it so the toolbar stays presentational.
     */
    filterControl?: ReactNode;
};

/**
 * The Activity Log filter toolbar: an actor-email search box plus an optional
 * advanced-filter control. The page owns the filter state (the URL query
 * string).
 */
export function ActivityToolbar({
    email,
    onEmailChange,
    filterControl
}: ActivityToolbarProps) {
    const intl = useIntl();

    return (
        <div className="mb-4 flex flex-wrap items-end gap-3">
            <InputGroup className="w-full shadow-none sm:max-w-[360px]">
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput
                    type="search"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    aria-label={intl.formatMessage(messages.searchLabel)}
                    placeholder={intl.formatMessage(messages.searchPlaceholder)}
                />
            </InputGroup>
            {filterControl}
        </div>
    );
}
