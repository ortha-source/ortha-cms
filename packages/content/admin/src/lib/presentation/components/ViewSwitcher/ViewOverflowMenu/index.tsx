import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown, Plus, Star, Users } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@orthacms/design-system';
import {
    VIEW_VISIBILITY,
    type SavedView
} from '../../../../domain/types/savedView';

/** Intl descriptors for {@link ViewOverflowMenu}, co-located. */
const messages = defineMessages({
    more: {
        id: 'content.views.overflow.more',
        defaultMessage: '{count} more'
    },
    label: {
        id: 'content.views.overflow.label',
        defaultMessage: '{count} more views'
    },
    search: {
        id: 'content.views.overflow.search',
        defaultMessage: 'Find a view'
    },
    empty: {
        id: 'content.views.overflow.empty',
        defaultMessage: 'No view by that name.'
    },
    yours: { id: 'content.views.overflow.yours', defaultMessage: 'Yours' },
    shared: { id: 'content.views.overflow.shared', defaultMessage: 'Shared' },
    newView: {
        id: 'content.views.switcher.newViewLabel',
        defaultMessage: 'New view from the current list'
    },
    shareHint: {
        id: 'content.views.tab.shared',
        defaultMessage: 'Shared with the workspace'
    },
    defaultHint: {
        id: 'content.views.tab.default',
        defaultMessage: 'Your default view'
    }
});

/**
 * The views that don't fit in the tab row, behind a **"N more ▾"** at its
 * end — searchable, grouped Yours / Shared (by visibility, as the views are
 * stored), with **New view from the current list** at the bottom. Picking one
 * applies it, and the switcher then brings its tab into the row (the selected
 * view is always on show), which is where its own menu lives.
 *
 * A `Popover` + `Command` rather than a `DropdownMenu`: a menu's typeahead
 * would take the keystrokes meant for the search box.
 */
export function ViewOverflowMenu({
    views,
    onSelect,
    onSaveAs
}: {
    /** The views folded out of the row, in row order. */
    views: SavedView[];
    onSelect: (view: SavedView) => void;
    onSaveAs: () => void;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const personal = views.filter(
        (view) => view.visibility === VIEW_VISIBILITY.Private
    );
    const shared = views.filter(
        (view) => view.visibility === VIEW_VISIBILITY.Workspace
    );

    const item = (view: SavedView) => (
        <CommandItem
            key={view.id}
            value={`${view.name} ${view.id}`}
            onSelect={() => {
                setOpen(false);
                onSelect(view);
            }}
        >
            {view.visibility === VIEW_VISIBILITY.Workspace ? (
                <Users
                    aria-label={intl.formatMessage(messages.shareHint)}
                    className="text-muted-foreground"
                />
            ) : null}
            <span className="min-w-0 flex-1 truncate">{view.name}</span>
            {view.isDefault ? (
                <Star
                    aria-label={intl.formatMessage(messages.defaultHint)}
                    className="fill-amber-400 text-amber-500"
                />
            ) : null}
        </CommandItem>
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={intl.formatMessage(messages.label, {
                        count: views.length
                    })}
                    className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=open]:text-foreground"
                >
                    {intl.formatMessage(messages.more, {
                        count: views.length
                    })}
                    <ChevronDown aria-hidden className="size-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                <Command>
                    <CommandInput
                        placeholder={intl.formatMessage(messages.search)}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {intl.formatMessage(messages.empty)}
                        </CommandEmpty>
                        {personal.length > 0 ? (
                            <CommandGroup
                                heading={intl.formatMessage(messages.yours)}
                            >
                                {personal.map(item)}
                            </CommandGroup>
                        ) : null}
                        {shared.length > 0 ? (
                            <CommandGroup
                                heading={intl.formatMessage(messages.shared)}
                            >
                                {shared.map(item)}
                            </CommandGroup>
                        ) : null}
                        <CommandSeparator />
                        <CommandGroup>
                            {/* Always offered, whatever the search says. */}
                            <CommandItem
                                forceMount
                                value="__new-view"
                                onSelect={() => {
                                    setOpen(false);
                                    onSaveAs();
                                }}
                            >
                                <Plus aria-hidden />
                                {intl.formatMessage(messages.newView)}
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
