import type { ReactNode, Ref } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import {
    DensityProvider,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner
} from '@orthacms/design-system';
import {
    ACTIVITY_RANGES,
    RANGE_MESSAGES,
    type ActivityRange
} from '../../activityRange';

/** Intl descriptors for {@link ActivityToolbar}, co-located. */
const messages = defineMessages({
    searchLabel: {
        id: 'activity.toolbar.searchLabel',
        defaultMessage: 'Search people, records, actions'
    },
    searchPlaceholder: {
        id: 'activity.toolbar.searchPlaceholder',
        defaultMessage: 'Search people, records, actions'
    },
    rangeLabel: {
        id: 'activity.toolbar.rangeLabel',
        defaultMessage: 'Time range'
    }
});

type ActivityToolbarProps = {
    /** The free-text search box's value. */
    search: string;
    onSearchChange: (value: string) => void;
    /** The time range, from the URL. */
    range: ActivityRange;
    onRangeChange: (range: ActivityRange) => void;
    /** The filter popover (it owns its own trigger). */
    filterControl?: ReactNode;
    /** Whether a search/filter request driven from here is still settling. */
    busy?: boolean;
    /** Ref to the search input, so the page can restore focus to it. */
    searchRef?: Ref<HTMLInputElement>;
};

/**
 * The Activity toolbar: one search box that finds people, records and
 * actions, the time range beside it, then the filter control — all three on
 * the left, in that order, the way the page reads.
 *
 * Composed from the same design-system pieces `SearchToolbar` is (an
 * `InputGroup` at compact density), rather than `SearchToolbar` itself, only
 * because that one pins its trailing controls to the far right edge; this page
 * keeps the range and the filter next to the box they qualify.
 */
export function ActivityToolbar({
    search,
    onSearchChange,
    range,
    onRangeChange,
    filterControl,
    busy = false,
    searchRef
}: ActivityToolbarProps) {
    const intl = useIntl();

    return (
        <DensityProvider density="compact">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <InputGroup className="w-full shadow-none sm:max-w-[320px]">
                    <InputGroupAddon>
                        {busy ? (
                            <Spinner aria-hidden className="size-4" />
                        ) : (
                            <Search />
                        )}
                    </InputGroupAddon>
                    <InputGroupInput
                        ref={searchRef}
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        aria-label={intl.formatMessage(messages.searchLabel)}
                        placeholder={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                    />
                </InputGroup>
                <Select
                    value={range}
                    onValueChange={(value) =>
                        onRangeChange(value as ActivityRange)
                    }
                >
                    <SelectTrigger
                        aria-label={intl.formatMessage(messages.rangeLabel)}
                        className="w-auto min-w-[8.5rem] shadow-none"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ACTIVITY_RANGES.map((option) => (
                            <SelectItem key={option} value={option}>
                                {intl.formatMessage(RANGE_MESSAGES[option])}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filterControl}
            </div>
        </DensityProvider>
    );
}
