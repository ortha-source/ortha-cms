import { defineMessages, useIntl } from 'react-intl';
import { Check, Search, SlidersHorizontal } from 'lucide-react';
import {
    Badge,
    Button,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn
} from '@ortha-cms/design-system';

/** The status the grid is filtered by. `Active` is the default view. */
export type StatusFilter = 'All' | 'Active' | 'Archived';

/** The default status filter; the count badge shows when the value differs. */
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
    filter: {
        id: 'workspaces.toolbar.filter',
        defaultMessage: 'Filter'
    },
    statusLegend: {
        id: 'workspaces.toolbar.statusLegend',
        defaultMessage: 'Status'
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
    count: {
        id: 'workspaces.toolbar.count',
        defaultMessage: '{shown} of {total}'
    }
});

const STATUS_OPTIONS: StatusFilter[] = ['All', 'Active', 'Archived'];

type WorkspaceToolbarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    status: StatusFilter;
    onStatusChange: (value: StatusFilter) => void;
    shown: number;
    total: number;
};

/**
 * The grid toolbar: a search box, a status filter popover (with a count badge
 * when the status differs from the default), and a live "{shown} of {total}"
 * count. Wraps to multiple rows on narrow viewports.
 */
export function WorkspaceToolbar({
    search,
    onSearchChange,
    status,
    onStatusChange,
    shown,
    total
}: WorkspaceToolbarProps) {
    const intl = useIntl();

    const statusLabel: Record<StatusFilter, string> = {
        All: intl.formatMessage(messages.statusAll),
        Active: intl.formatMessage(messages.statusActive),
        Archived: intl.formatMessage(messages.statusArchived)
    };

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

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="shadow-none">
                        <SlidersHorizontal />
                        {intl.formatMessage(messages.filter)}
                        {status !== DEFAULT_STATUS ? (
                            <Badge
                                variant="secondary"
                                className="ml-1 rounded-full px-1.5"
                            >
                                1
                            </Badge>
                        ) : null}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56">
                    <div
                        role="radiogroup"
                        aria-label={intl.formatMessage(messages.statusLegend)}
                        className="flex flex-col gap-1"
                    >
                        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                            {intl.formatMessage(messages.statusLegend)}
                        </p>
                        {STATUS_OPTIONS.map((option) => {
                            const selected = option === status;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => onStatusChange(option)}
                                    className={cn(
                                        'flex items-center justify-between rounded-md px-2 py-1.5 text-sm',
                                        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        selected && 'font-medium'
                                    )}
                                >
                                    {statusLabel[option]}
                                    {selected ? (
                                        <Check className="size-4" />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </PopoverContent>
            </Popover>

            <span className="ml-auto text-sm text-muted-foreground">
                {intl.formatMessage(messages.count, { shown, total })}
            </span>
        </div>
    );
}
