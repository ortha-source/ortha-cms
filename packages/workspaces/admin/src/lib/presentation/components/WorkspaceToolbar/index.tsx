import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import {
    DensityProvider,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    SegmentedControl,
    SegmentedControlCount,
    SegmentedControlItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@orthacms/design-system';
import {
    WORKSPACE_SORTS,
    type WorkspaceSort
} from '../../../domain/workspaceSort';

/** The status the list is filtered by. `Active` is the default view. */
export type StatusFilter = 'All' | 'Active' | 'Archived';

/** The default status filter. */
export const DEFAULT_STATUS: StatusFilter = 'Active';

/** Intl descriptors for {@link WorkspaceToolbar}, co-located with the component. */
const messages = defineMessages({
    searchLabel: {
        id: 'workspaces.toolbar.searchLabel',
        defaultMessage: 'Search workspaces'
    },
    searchPlaceholder: {
        id: 'workspaces.toolbar.searchPlaceholder',
        defaultMessage: 'Search workspaces'
    },
    statusLegend: {
        id: 'workspaces.toolbar.statusLegend',
        defaultMessage: 'Filter by status'
    },
    statusAll: {
        id: 'workspaces.toolbar.statusAll',
        defaultMessage: 'All'
    },
    statusActive: {
        id: 'workspaces.toolbar.statusActive',
        defaultMessage: 'Active'
    },
    statusArchived: {
        id: 'workspaces.toolbar.statusArchived',
        defaultMessage: 'Archived'
    },
    sortLabel: {
        id: 'workspaces.toolbar.sortLabel',
        defaultMessage: 'Sort workspaces'
    },
    sortEdited: {
        id: 'workspaces.toolbar.sortEdited',
        defaultMessage: 'Recently edited'
    },
    sortName: {
        id: 'workspaces.toolbar.sortName',
        defaultMessage: 'Name'
    },
    sortCreated: {
        id: 'workspaces.toolbar.sortCreated',
        defaultMessage: 'Recently created'
    },
    countAnnouncement: {
        id: 'workspaces.toolbar.countAnnouncement',
        defaultMessage:
            '{shown, plural, one {# workspace shown} other {# workspaces shown}} of {total}.'
    },
    statusOption: {
        id: 'workspaces.toolbar.statusOption',
        defaultMessage:
            '{label}, {count, plural, one {# workspace} other {# workspaces}}'
    }
});

const STATUS_OPTIONS: StatusFilter[] = ['All', 'Active', 'Archived'];

type WorkspaceToolbarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    status: StatusFilter;
    onStatusChange: (value: StatusFilter) => void;
    /** How many workspaces fall under each status (for the chip counts). */
    counts: Record<StatusFilter, number>;
    /** The card order. */
    sort: WorkspaceSort;
    onSortChange: (value: WorkspaceSort) => void;
    shown: number;
    total: number;
};

/**
 * The list toolbar — sort and filter, nothing more: a search box, the status
 * filter as a segmented chip group (All / Active / Archived, each badged with
 * its count) and the order (recently edited by default, so the busy
 * workspaces come first). A polite live region restates how many cards a
 * search or filter left. Wraps to multiple rows on narrow viewports.
 */
export function WorkspaceToolbar({
    search,
    onSearchChange,
    status,
    onStatusChange,
    counts,
    sort,
    onSortChange,
    shown,
    total
}: WorkspaceToolbarProps) {
    const intl = useIntl();

    const statusLabel: Record<StatusFilter, string> = {
        All: intl.formatMessage(messages.statusAll),
        Active: intl.formatMessage(messages.statusActive),
        Archived: intl.formatMessage(messages.statusArchived)
    };

    const sortLabel: Record<WorkspaceSort, string> = {
        edited: intl.formatMessage(messages.sortEdited),
        name: intl.formatMessage(messages.sortName),
        created: intl.formatMessage(messages.sortCreated)
    };

    return (
        <DensityProvider density="compact">
            <div className="mb-1 flex flex-wrap items-center gap-2">
                <InputGroup className="w-full shadow-none sm:max-w-[260px]">
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        aria-label={intl.formatMessage(messages.searchLabel)}
                        placeholder={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                    />
                </InputGroup>

                <SegmentedControl
                    value={status}
                    // Radix single-toggle can emit '' when the active chip is
                    // re-clicked; ignore that so a status is always selected.
                    onValueChange={(value) => {
                        if (value) {
                            onStatusChange(value as StatusFilter);
                        }
                    }}
                    aria-label={intl.formatMessage(messages.statusLegend)}
                >
                    {STATUS_OPTIONS.map((option) => (
                        <SegmentedControlItem
                            key={option}
                            value={option}
                            // The badge stays `aria-hidden` so the count isn't read
                            // as a stray number after the label — but the number is
                            // decision-shaping ("Archived" hiding 2 workspaces reads
                            // very differently from 0), so it moves into the radio's
                            // own name rather than being dropped from the a11y tree.
                            aria-label={intl.formatMessage(
                                messages.statusOption,
                                {
                                    label: statusLabel[option],
                                    count: counts[option]
                                }
                            )}
                        >
                            {statusLabel[option]}
                            <SegmentedControlCount aria-hidden>
                                {counts[option]}
                            </SegmentedControlCount>
                        </SegmentedControlItem>
                    ))}
                </SegmentedControl>

                <Select
                    value={sort}
                    onValueChange={(value) =>
                        onSortChange(value as WorkspaceSort)
                    }
                >
                    <SelectTrigger
                        className="ml-auto w-auto gap-2 shadow-none"
                        aria-label={intl.formatMessage(messages.sortLabel)}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {WORKSPACE_SORTS.map((option) => (
                            <SelectItem key={option} value={option}>
                                {sortLabel[option]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* A search or a status change just swaps the cards; this
                    polite live region is what tells a screen-reader user it
                    did anything. */}
                <span role="status" aria-live="polite" className="sr-only">
                    {intl.formatMessage(messages.countAnnouncement, {
                        shown,
                        total
                    })}
                </span>
            </div>
        </DensityProvider>
    );
}
