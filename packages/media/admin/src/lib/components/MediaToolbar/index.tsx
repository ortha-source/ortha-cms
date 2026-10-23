import { defineMessages, useIntl } from 'react-intl';
import {
    DensityProvider,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    SegmentedControl,
    SegmentedControlItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    cn
} from '@orthacms/design-system';
import { LayoutGrid, List, Search } from 'lucide-react';
import {
    KIND_FILTER_ALL,
    MEDIA_KIND,
    MEDIA_SORT,
    MEDIA_VIEW,
    type MediaSort,
    type MediaView
} from '../../constants';
import type { KindFilter } from '../../hooks/useMediaLibrary';

/** Intl descriptors for {@link MediaToolbar}, co-located. */
const messages = defineMessages({
    search: { id: 'media.toolbar.search', defaultMessage: 'Search assets' },
    searchPlaceholder: {
        id: 'media.toolbar.searchPlaceholder',
        defaultMessage: 'Search name or tag…'
    },
    kindLabel: {
        id: 'media.toolbar.kindLabel',
        defaultMessage: 'Filter by type'
    },
    kindAll: { id: 'media.toolbar.kindAll', defaultMessage: 'All' },
    kindImage: { id: 'media.toolbar.kindImage', defaultMessage: 'Images' },
    kindVideo: { id: 'media.toolbar.kindVideo', defaultMessage: 'Video' },
    kindAudio: { id: 'media.toolbar.kindAudio', defaultMessage: 'Audio' },
    kindDocument: {
        id: 'media.toolbar.kindDocument',
        defaultMessage: 'Documents'
    },
    kindArchive: {
        id: 'media.toolbar.kindArchive',
        defaultMessage: 'Archives'
    },
    sortLabel: { id: 'media.toolbar.sortLabel', defaultMessage: 'Sort' },
    sortNewest: {
        id: 'media.toolbar.sortNewest',
        defaultMessage: 'Newest first'
    },
    sortOldest: {
        id: 'media.toolbar.sortOldest',
        defaultMessage: 'Oldest first'
    },
    sortNameAsc: {
        id: 'media.toolbar.sortNameAsc',
        defaultMessage: 'Name A–Z'
    },
    sortNameDesc: {
        id: 'media.toolbar.sortNameDesc',
        defaultMessage: 'Name Z–A'
    },
    sortLargest: { id: 'media.toolbar.sortLargest', defaultMessage: 'Largest' },
    sortSmallest: {
        id: 'media.toolbar.sortSmallest',
        defaultMessage: 'Smallest'
    },
    viewLabel: { id: 'media.toolbar.viewLabel', defaultMessage: 'View' },
    viewGrid: { id: 'media.toolbar.viewGrid', defaultMessage: 'Grid view' },
    viewList: { id: 'media.toolbar.viewList', defaultMessage: 'List view' }
});

/** The type chips, in reading order — "All" first, the kinds after it. */
const KIND_CHIPS: { value: KindFilter; label: keyof typeof messages }[] = [
    { value: KIND_FILTER_ALL, label: 'kindAll' },
    { value: MEDIA_KIND.Image, label: 'kindImage' },
    { value: MEDIA_KIND.Video, label: 'kindVideo' },
    { value: MEDIA_KIND.Audio, label: 'kindAudio' },
    { value: MEDIA_KIND.Document, label: 'kindDocument' },
    { value: MEDIA_KIND.Archive, label: 'kindArchive' }
];

/**
 * The Media Library's control bar — the **type chips** (All · Images · Video ·
 * Audio · Documents · Archives, one pressed at a time; the same pill the
 * records table's status chips are) on the left, then a search box, a sort
 * select and the Grid / List switch on the right. Fully controlled: every value
 * lives in the page and changes dispatch straight back up. New folder and
 * Upload are the page's top-bar actions, not this bar's.
 */
export function MediaToolbar({
    search,
    onSearchChange,
    kindFilter,
    onKindFilterChange,
    sort,
    onSortChange,
    view,
    onViewChange
}: {
    search: string;
    onSearchChange: (value: string) => void;
    kindFilter: KindFilter;
    onKindFilterChange: (value: KindFilter) => void;
    sort: MediaSort;
    onSortChange: (value: MediaSort) => void;
    view: MediaView;
    onViewChange: (value: MediaView) => void;
}) {
    const intl = useIntl();

    return (
        <DensityProvider density="compact">
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div
                    role="group"
                    aria-label={intl.formatMessage(messages.kindLabel)}
                    className="flex flex-wrap items-center gap-1.5"
                >
                    {KIND_CHIPS.map(({ value, label }) => {
                        const on = kindFilter === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={on}
                                onClick={() => onKindFilterChange(value)}
                                className={cn(
                                    'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                                    on
                                        ? 'border-foreground bg-foreground text-background'
                                        : 'bg-background text-foreground hover:bg-muted'
                                )}
                            >
                                {intl.formatMessage(messages[label])}
                            </button>
                        );
                    })}
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                    <InputGroup className="w-full shadow-none sm:w-[200px]">
                        <InputGroupAddon>
                            <Search />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="search"
                            value={search}
                            onChange={(event) =>
                                onSearchChange(event.target.value)
                            }
                            aria-label={intl.formatMessage(messages.search)}
                            placeholder={intl.formatMessage(
                                messages.searchPlaceholder
                            )}
                        />
                    </InputGroup>

                    <Select
                        value={sort}
                        onValueChange={(value) =>
                            onSortChange(value as MediaSort)
                        }
                    >
                        <SelectTrigger
                            className="w-[132px] shadow-none"
                            aria-label={intl.formatMessage(messages.sortLabel)}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={MEDIA_SORT.Newest}>
                                {intl.formatMessage(messages.sortNewest)}
                            </SelectItem>
                            <SelectItem value={MEDIA_SORT.Oldest}>
                                {intl.formatMessage(messages.sortOldest)}
                            </SelectItem>
                            <SelectItem value={MEDIA_SORT.NameAsc}>
                                {intl.formatMessage(messages.sortNameAsc)}
                            </SelectItem>
                            <SelectItem value={MEDIA_SORT.NameDesc}>
                                {intl.formatMessage(messages.sortNameDesc)}
                            </SelectItem>
                            <SelectItem value={MEDIA_SORT.Largest}>
                                {intl.formatMessage(messages.sortLargest)}
                            </SelectItem>
                            <SelectItem value={MEDIA_SORT.Smallest}>
                                {intl.formatMessage(messages.sortSmallest)}
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <SegmentedControl
                        variant="muted"
                        value={view}
                        // A single toggle group reports '' when its pressed
                        // item is pressed again; a view switch can't be off.
                        onValueChange={(value) => {
                            if (value) onViewChange(value as MediaView);
                        }}
                        aria-label={intl.formatMessage(messages.viewLabel)}
                    >
                        <SegmentedControlItem
                            value={MEDIA_VIEW.Grid}
                            aria-label={intl.formatMessage(messages.viewGrid)}
                            className="px-2"
                        >
                            <LayoutGrid className="size-4" aria-hidden />
                        </SegmentedControlItem>
                        <SegmentedControlItem
                            value={MEDIA_VIEW.List}
                            aria-label={intl.formatMessage(messages.viewList)}
                            className="px-2"
                        >
                            <List className="size-4" aria-hidden />
                        </SegmentedControlItem>
                    </SegmentedControl>
                </div>
            </div>
        </DensityProvider>
    );
}
