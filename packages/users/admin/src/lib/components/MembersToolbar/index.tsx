import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from '@ortha-cms/design-system';

/** Intl descriptors for {@link MembersToolbar}, co-located with the component. */
const messages = defineMessages({
    searchLabel: {
        id: 'users.toolbar.searchLabel',
        defaultMessage: 'Search members by name or email'
    },
    searchPlaceholder: {
        id: 'users.toolbar.searchPlaceholder',
        defaultMessage: 'Search by name or email'
    }
});

/**
 * The table toolbar: a search box filtering members by name or email, plus an
 * optional advanced-filter control (the query-builder drawer trigger). The page
 * owns the filter state.
 */
export function MembersToolbar({
    search,
    onSearchChange,
    filterControl
}: {
    search: string;
    onSearchChange: (value: string) => void;
    /** Optional advanced-filter control rendered after the search box. */
    filterControl?: ReactNode;
}) {
    const intl = useIntl();

    return (
        <div className="mb-4 flex flex-wrap items-center gap-3">
            <InputGroup className="w-full shadow-none sm:max-w-[360px]">
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput
                    type="search"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    aria-label={intl.formatMessage(messages.searchLabel)}
                    placeholder={intl.formatMessage(messages.searchPlaceholder)}
                />
            </InputGroup>
            {filterControl}
        </div>
    );
}
