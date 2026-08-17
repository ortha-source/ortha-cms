'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

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
    /** Trigger id (wires an external `<label htmlFor>`). */
    id?: string;
    /** Marks the trigger invalid (`aria-invalid`). */
    invalid?: boolean;
    /** Disables the control. */
    disabled?: boolean;
    /** Ids of the hint/error elements describing the trigger. */
    'aria-describedby'?: string;
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
    emptyText = 'No results.',
    id,
    invalid,
    disabled,
    'aria-describedby': ariaDescribedby,
    className
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const selected = new Set(value);

    const toggle = (option: string) =>
        onChange(
            selected.has(option)
                ? value.filter((item) => item !== option)
                : [...value, option]
        );

    const labelOf = (val: string) =>
        options.find((option) => option.value === val)?.label ?? val;

    return (
        <Popover open={open} onOpenChange={setOpen}>
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
                className="w-[var(--radix-popover-trigger-width)] max-w-[300px] overflow-hidden p-0"
                align="start"
            >
                {/* `overflow-hidden` + a square `Command` clip the search
                    field's divider to the popover's rounded corners. */}
                <Command className="rounded-none">
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList aria-multiselectable="true">
                        <CommandEmpty>{emptyText}</CommandEmpty>
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
