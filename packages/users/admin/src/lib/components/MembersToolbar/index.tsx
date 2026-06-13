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
 * The table toolbar: a single search box filtering members by name or email.
 * Deliberately filterless beyond search — no role or status filters on this
 * page.
 */
export function MembersToolbar({
    search,
    onSearchChange
}: {
    search: string;
    onSearchChange: (value: string) => void;
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
        </div>
    );
}
