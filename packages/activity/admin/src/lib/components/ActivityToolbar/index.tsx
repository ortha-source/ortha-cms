import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from '@ortha-cms/design-system';
import { ActivityKindFilter } from '../ActivityKindFilter';

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
    /** Selected kind (empty for all). */
    kind: string;
    onKindChange: (value: string) => void;
    /** Actor-email search box value. */
    email: string;
    onEmailChange: (value: string) => void;
};

/**
 * The Activity Log filter toolbar: an action (kind) select and an actor-email
 * search box. Each control reports its change up; the page owns the filter
 * state (the URL query string).
 */
export function ActivityToolbar({
    kind,
    onKindChange,
    email,
    onEmailChange
}: ActivityToolbarProps) {
    const intl = useIntl();

    return (
        <div className="mb-4 flex flex-wrap items-end gap-3">
            <ActivityKindFilter value={kind} onChange={onKindChange} />
            <InputGroup className="w-full shadow-none sm:max-w-[280px]">
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
        </div>
    );
}
