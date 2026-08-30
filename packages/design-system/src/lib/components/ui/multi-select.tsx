'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';

import { cn } from '../../utils';
import { Badge } from './badge';
import { Button } from './button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/** One selectable option. */
type MultiSelectOption = {
    value: string;
    label: string;
};

type MultiSelectProps = {
    /** The available options. */
    options: MultiSelectOption[];
    /** Currently-selected values. */
    value: string[];
    /** Called with the next selection when an option is toggled. */
    onChange: (value: string[]) => void;
    /** Trigger placeholder when nothing is selected. */
    placeholder?: string;
    /** Placeholder for the in-popover search box. */
    searchPlaceholder?: string;
    /** Shown when the search matches no option. */
    emptyText?: string;
    /**
     * Makes the search box able to add a value that is not among `options`.
     *
     * Called with the raw query when that row is chosen; the caller decides
     * what the query means (it may name several values) and folds the result
     * into `value`. Omit it for a closed list — a picker whose options are the
     * only legal answers.
     */
    onCreate?: (query: string) => void;
    /**
     * Label for the add row, given the trimmed query. Defaults to
     * `Add "<query>"`; pass a translated one.
     */
    createLabel?: (query: string) => string;
    /** Trigger id (wires an external `<label htmlFor>`). */
    id?: string;
    /** Marks the trigger invalid (`aria-invalid`). */
    invalid?: boolean;
    /** Disables the control. */
    disabled?: boolean;
    /** Ids of the hint/error elements describing the trigger. */
    'aria-describedby'?: string;
    /**
     * Accessible name for the **popover**, which Radix renders as a
     * `role="dialog"`. Without one a screen-reader user who opens the selector
     * is told only "dialog" — the trigger's own label is outside it and no
     * longer read. Defaults to the trigger's `placeholder`, so the common case
     * needs nothing; pass this when the placeholder is not a good name for the
     * list ("Select workspaces" is, "Choose…" is not).
     */
    popoverLabel?: string;
    /**
     * Where the popover portals. Pass the DOM node of a **scroll-locking**
     * ancestor — a Radix `Dialog`'s content, a vaul `Drawer` — when this is
     * rendered inside one. react-remove-scroll allow-lists only that ancestor's
     * subtree, and a popover portaled to `document.body` sits outside it, so the
     * option list scrolls by dragging its scrollbar but **not** by mouse wheel.
     * Defaults to the body portal, which is right for a control on an ordinary
     * page.
     */
    container?: HTMLElement | null;
    className?: string;
};

/**
 * A searchable multi-select built from `Popover` + `Command` + `Badge` (shadcn
 * has no core multi-select). The trigger shows the selected options as badges
 * (read-only — deselect from the popover, not the badge); the popover lists
 * options with a check on the selected ones, each row carrying `aria-checked`
 * so the selection is legible without sight. Search matches an option's `label`
 * **and** its `value`. Fully controlled via `value`/`onChange`.
 */
function MultiSelect({
    options,
    value,
    onChange,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    popoverLabel,
    emptyText = 'No results.',
    onCreate,
    createLabel = (query) => `Add “${query}”`,
    id,
    invalid,
    disabled,
    'aria-describedby': ariaDescribedby,
    container,
    className
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    // Controlled so the add row can read what was typed, and so a stale query
    // does not filter the list the next time the popover opens.
    const [search, setSearch] = React.useState('');
    const selected = new Set(value);

    const query = search.trim();
    // Offering to add something the list already has is noise — and would
    // produce a duplicate row that toggles a different code path than the
    // option beside it.
    const canCreate =
        onCreate !== undefined &&
        query.length > 0 &&
        !options.some((option) => option.value === query);

    const toggle = (option: string) =>
        onChange(
            selected.has(option)
                ? value.filter((item) => item !== option)
                : [...value, option]
        );

    const labelOf = (val: string) =>
        options.find((option) => option.value === val)?.label ?? val;

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setSearch('');
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    // Radix's Popover trigger declares `dialog`; what actually
                    // opens is a listbox, and that is what a screen-reader user
                    // needs to be told before opening it.
                    aria-haspopup="listbox"
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedby}
                    disabled={disabled}
                    className={cn(
                        'h-auto min-h-9 w-full justify-between px-3 py-1.5 font-normal shadow-none hover:bg-background aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
                        className
                    )}
                >
                    <span className="flex flex-1 flex-wrap items-center gap-1">
                        {value.length === 0 ? (
                            <span className="text-muted-foreground">
                                {placeholder}
                            </span>
                        ) : (
                            value.map((val) => (
                                <Badge key={val} variant="secondary">
                                    {labelOf(val)}
                                </Badge>
                            ))
                        )}
                    </span>
                    <ChevronsUpDown
                        className="size-4 shrink-0 opacity-50"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                aria-label={popoverLabel ?? placeholder}
                className="w-[var(--radix-popover-trigger-width)] max-w-[300px] overflow-hidden p-0"
                align="start"
                container={container}
            >
                {/* `overflow-hidden` + a square `Command` clip the search
                    field's divider to the popover's rounded corners. */}
                <Command className="rounded-none">
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList aria-multiselectable="true">
                        {/* With an add row on offer there is always something
                            to do, so the "no results" copy would be a lie. */}
                        {canCreate ? null : (
                            <CommandEmpty>{emptyText}</CommandEmpty>
                        )}
                        {canCreate ? (
                            <CommandGroup>
                                <CommandItem
                                    // The query matches itself, so cmdk keeps
                                    // this row visible whatever was typed.
                                    value={query}
                                    onSelect={() => {
                                        onCreate?.(search);
                                        setSearch('');
                                    }}
                                >
                                    <Plus className="size-4" aria-hidden />
                                    {createLabel(query)}
                                </CommandItem>
                            </CommandGroup>
                        ) : null}
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    // cmdk identifies, filters and highlights a
                                    // row by `value`. Keying it on the label
                                    // merged two options that happen to share
                                    // one — both highlighted together, and the
                                    // arrow keys could not tell them apart —
                                    // and made the option's own value
                                    // unsearchable. `keywords` puts the label
                                    // back into the filter.
                                    value={option.value}
                                    keywords={[option.label]}
                                    // cmdk owns `aria-selected` (it tracks the
                                    // *highlight*) and overwrites whatever a
                                    // caller passes, so chosen-ness rides on
                                    // `aria-checked`, which `role="option"`
                                    // supports and cmdk never sets. Before
                                    // this, the only signal was an
                                    // `aria-hidden` tick differing by opacity —
                                    // invisible to assistive tech and to anyone
                                    // who cannot separate the two by colour.
                                    aria-checked={selected.has(option.value)}
                                    onSelect={() => toggle(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            'size-4',
                                            selected.has(option.value)
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        )}
                                        aria-hidden
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export { MultiSelect };
export type { MultiSelectOption, MultiSelectProps };
